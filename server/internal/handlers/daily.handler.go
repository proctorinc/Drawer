package handlers

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/achievements"
	"drawer-service-backend/internal/ai"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/notifications"
	"drawer-service-backend/internal/storage"
	"drawer-service-backend/internal/utils"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type DailyPromptResponse struct {
	Day         string          `json:"day"`
	Colors      []string        `json:"colors"`
	Pencils     []models.Pencil `json:"pencils,omitempty"`
	Prompt      string          `json:"prompt"`
	IsCompleted bool            `json:"isCompleted"`
	CreatedBy   *models.User    `json:"createdBy"`
}

func HandleGetDailyPrompt(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	now := time.Now()
	today := utils.GetFormattedDate(now)
	userID := middleware.GetUserID(c)
	user := middleware.GetUser(c)

	hasSubmittedToday, err := queries.CheckUserSubmittedToday(appCtx.DB, c.Request.Context(), userID)

	if err != nil {
		log.Printf("Error checking existing submission for user %s (email: %s), day %s: %v",
			userID, utils.MaskEmail(user.Email), today, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, ErrorResponse{Message: "Server error checking submission status"})
		return
	}

	prompt, err := queries.GetDailyPrompt(appCtx.DB, c.Request.Context(), today)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Printf("No daily prompt found for today (%s)", today)
			c.AbortWithStatusJSON(http.StatusNoContent, ErrorResponse{Message: "There is no daily prompt for today."})
			return
		} else {
			log.Printf("Error fetching daily prompt for %s from DB: %v", today, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, ErrorResponse{Message: "Failed to retrieve daily prompt"})
			return
		}
	}

	response := DailyPromptResponse{
		IsCompleted: hasSubmittedToday,
		Day:         prompt.Day,
		Colors:      prompt.Colors,
		Pencils:     prompt.Pencils,
		Prompt:      prompt.Prompt,
		CreatedBy:   prompt.CreatedBy,
	}

	c.JSON(http.StatusOK, response)
}

func HandleSubmitDailyPrompt(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	now := time.Now()
	today := utils.GetFormattedDate(now)
	requester := middleware.GetUser(c)

	// The app says which prompt the drawing is for. Today's, or (older apps) none, is the
	// usual daily doodle. Yesterday's may be one the rollover interrupted, which can be
	// finished if it was started while its prompt was live. Any other past day needs a redo.
	day := today
	late, redo := false, false
	if asked := c.PostForm("day"); asked != "" && asked != today {
		lateDay, err := queries.LateDay(appCtx.DB, ctx, requester.ID, now)
		if err != nil {
			log.Printf("Error checking late drawing for user %s: %v", utils.MaskEmail(requester.Email), err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Server error checking submission status"))
			return
		}
		switch {
		case asked == lateDay:
			day, late = lateDay, true
		case isPastDay(asked, today):
			// Checked against their redos when it's recorded
			day, redo = asked, true
		default:
			log.Printf("Submit for %s refused for user %s on %s", asked, utils.MaskEmail(requester.Email), today)
			c.AbortWithStatusJSON(http.StatusConflict, Error("That prompt has closed"))
			return
		}
	}

	alreadySubmitted, err := queries.CheckUserSubmittedOn(appCtx.DB, ctx, requester.ID, day)
	if err != nil {
		log.Printf("Error checking existing submission for user %s, day %s: %v",
			utils.MaskEmail(requester.Email), day, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Server error checking submission status"))
		return
	}

	if alreadySubmitted {
		log.Printf("Additional submit attempt for user %s (email: %s), day %s",
			requester.ID, utils.MaskEmail(requester.Email), day)
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, Error("You have already submitted a drawing for that day"))
		return
	}

	file, err := c.FormFile("image")
	if err != nil {
		log.Printf("Error getting image file for user %s: %v",
			utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("No image file provided"))
		return
	}

	buf, err := utils.ReadFileToBuffer(file)
	if err != nil {
		log.Printf("Error reading image file for user %s: %v",
			utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to read image file"))
		return
	}

	var submissionID string
	if redo {
		// Free on a missed event day, else uses up one of their redos, or refuses if none covers it
		submissionID, err = queries.InsertRedoSubmission(appCtx.DB, ctx, requester.ID, day, today, queries.FreeRedoDaysAt(appCtx.DB, ctx, now))
		if errors.Is(err, queries.ErrNoRedo) {
			log.Printf("Redo for %s refused for user %s: no redo covers it", day, utils.MaskEmail(requester.Email))
			c.AbortWithStatusJSON(http.StatusConflict, Error("That prompt has closed"))
			return
		}
	} else {
		submissionID, err = queries.InsertSubmissionRecord(appCtx.DB, ctx, queries.InsertSubmissionRecordParams{
			UserID: requester.ID,
			Day:    day,
			Late:   late,
		})
	}

	if err != nil {
		log.Printf("Failed to insert submission record for user %s, day %s: %v",
			utils.MaskEmail(requester.Email), today, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to record submission"))
		return
	}

	var imageURL string

	if appCtx.Config.Env != "development" {
		storageService := storage.NewStorageService(appCtx.Config)

		url, err := storageService.UploadSubmission(requester.ID, submissionID, buf)
		if err != nil {
			log.Printf("Error uploading image to S3 for user %s: %v",
				utils.MaskEmail(requester.Email), err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Error uploading image"))
			return
		}

		imageURL = url
	} else {
		imageURL = "/example.png"
	}

	log.Printf("User %s successfully submitted drawing for %s (late: %t, redo: %t)", utils.MaskEmail(requester.Email), day, late, redo)

	// Sent before responding: Cloud Run throttles CPU once the response is out, so a
	// push left in a goroutine waits for the next request to this instance. Friends aren't
	// pinged about an old prompt's doodle: "just posted their daily drawing" would be wrong.
	if !late && !redo {
		if err := notifications.NotifyFriendsOfSubmission(appCtx.DB, requester.ID, requester.Username, submissionID, appCtx.Config); err != nil {
			log.Printf("Failed to send friend notifications for user %s: %v", utils.MaskEmail(requester.Email), err)
		}
	}

	// The AI judge scores it and leaves a comment, if the judges are switched on. It's marked
	// pending before we answer, so the app knows to wait for it; with judging off there's
	// no record at all and the doodle shows no AI UI.
	if review, err := ai.StartNewSubmissionReview(ctx, appCtx.DB, appCtx.Config, submissionID); err != nil {
		log.Printf("AI judge: couldn't start reviewing %s: %v", submissionID, err)
	} else if review != nil {
		review.OnDone = func(artistID, submissionID string, judge models.AIPersonality, verdict ai.Verdict) {
			if err := notifications.NotifyUserOfAIReview(appCtx.DB, artistID, submissionID, judge.Name, verdict.Score, appCtx.Config); err != nil {
				log.Printf("AI judge: couldn't notify %s about %s's review: %v", artistID, judge.Name, err)
			}
			judged := achievements.NewAchievementService(appCtx.DB, context.Background(), artistID)
			if err := judged.UpdateJudgeAchievements(artistID); err != nil {
				log.Printf("AI judge: couldn't update %s's judge achievements: %v", artistID, err)
			}
		}
		go review.Run(buf)
	}

	go func() {
		achievementService := achievements.NewAchievementService(appCtx.DB, context.Background(), requester.ID)
		err := achievementService.UpdateSubmissionAchievements(requester.ID)
		if err != nil {
			log.Printf("Error updating friend achievements for %s: %v", requester.ID, err)
		}
	}()

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Drawing submitted successfully",
		"day":      day,
		"late":     late,
		"redo":     redo,
		"imageUrl": imageURL,
		"id":       submissionID,
	})
}

// HandleStartDailyDrawing notes the first stroke on today's prompt, so a doodle the rollover
// interrupts can still be finished tomorrow (see queries.LateDay). The drawing stays on the device.
func HandleStartDailyDrawing(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	user := middleware.GetUser(c)
	today := utils.GetFormattedDate(time.Now())
	if err := queries.RecordDrawingStart(appCtx.DB, c.Request.Context(), user.ID, today); err != nil {
		log.Printf("HandleStartDailyDrawing: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't note your start"))
		return
	}
	c.Status(http.StatusNoContent)
}

// HandleGetUnfinishedPrompt returns yesterday's prompt if the user can still finish it, or
// {"prompt": null}. Whether there's a drawing to finish is up to the device that started it.
func HandleGetUnfinishedPrompt(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	user := middleware.GetUser(c)

	day, err := queries.LateDay(appCtx.DB, ctx, user.ID, time.Now())
	if err != nil {
		log.Printf("HandleGetUnfinishedPrompt: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't check for unfinished drawings"))
		return
	}
	if day == "" {
		c.JSON(http.StatusOK, gin.H{"prompt": nil})
		return
	}
	prompt, err := queries.GetDailyPrompt(appCtx.DB, ctx, day)
	if err != nil {
		log.Printf("HandleGetUnfinishedPrompt: prompt for %s: %v", day, err)
		c.JSON(http.StatusOK, gin.H{"prompt": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"prompt": DailyPromptResponse{
		Day:       prompt.Day,
		Colors:    prompt.Colors,
		Pencils:   prompt.Pencils,
		Prompt:    prompt.Prompt,
		CreatedBy: prompt.CreatedBy,
	}})
}

// isPastDay reports whether day is a real YYYY-MM-DD date before today.
func isPastDay(day, today string) bool {
	_, err := time.Parse(utils.DateFormat, day)
	return err == nil && day < today
}

// RedosResponse is what a player can redo: how many redos they hold, what each is for, the
// missed prompts those cover, newest first, and which of those are free (cost no redo).
type RedosResponse struct {
	Grants   []queries.RedoGrant   `json:"grants"`
	Prompts  []DailyPromptResponse `json:"prompts"`
	FreeDays []string              `json:"freeDays"`
}

// HandleGetRedos lists the player's unused redos and the missed prompts they can spend them on.
func HandleGetRedos(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	user := middleware.GetUser(c)
	now := time.Now()
	today := utils.GetFormattedDate(now)

	grants, err := queries.UnusedRedoGrants(appCtx.DB, ctx, user.ID)
	if err != nil {
		log.Printf("HandleGetRedos: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load your redos"))
		return
	}
	response := RedosResponse{Grants: grants, Prompts: []DailyPromptResponse{}, FreeDays: []string{}}
	free := queries.FreeRedoDaysAt(appCtx.DB, ctx, now)
	if len(grants) == 0 && free.First == "" {
		c.JSON(http.StatusOK, response)
		return
	}

	// Yesterday's, while it can still be finished late, doesn't need a redo
	lateDay, err := queries.LateDay(appCtx.DB, ctx, user.ID, now)
	if err != nil {
		log.Printf("HandleGetRedos: %v", err)
	}
	days, err := queries.RedoableDays(appCtx.DB, ctx, user.ID, today, lateDay, free)
	if err != nil {
		log.Printf("HandleGetRedos: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load your redos"))
		return
	}
	for _, day := range days {
		prompt, err := queries.GetDailyPrompt(appCtx.DB, ctx, day)
		if err != nil {
			log.Printf("HandleGetRedos: prompt for %s: %v", day, err)
			continue
		}
		response.Prompts = append(response.Prompts, DailyPromptResponse{
			Day:       prompt.Day,
			Colors:    prompt.Colors,
			Pencils:   prompt.Pencils,
			Prompt:    prompt.Prompt,
			CreatedBy: prompt.CreatedBy,
		})
		if free.Covers(day) {
			response.FreeDays = append(response.FreeDays, day)
		}
	}
	c.JSON(http.StatusOK, response)
}
