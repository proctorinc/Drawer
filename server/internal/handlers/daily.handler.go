package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/context"
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
	Day         string   `json:"day"`
	Colors      []string `json:"colors"`
	Prompt      string   `json:"prompt"`
	IsCompleted bool     `json:"isCompleted"`
}

func HandleGetDailyPrompt(c *gin.Context) {
	appCtx := context.GetCtx(c)
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
		Prompt:      prompt.Prompt,
	}

	c.JSON(http.StatusOK, response)
}

func HandleSubmitDailyPrompt(c *gin.Context) {
	appCtx := context.GetCtx(c)
	ctx := c.Request.Context()
	today := utils.GetFormattedDate(time.Now())
	requester := middleware.GetUser(c)

	alreadySubmittedToday, err := queries.CheckUserSubmittedToday(appCtx.DB, ctx, requester.ID)
	if err != nil {
		log.Printf("Error checking existing submission for user %s, day %s: %v",
			utils.MaskEmail(requester.Email), today, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Server error checking submission status"))
		return
	}

	if alreadySubmittedToday {
		log.Printf("Additional submit attempt for user %s (email: %s), day %s",
			requester.ID, utils.MaskEmail(requester.Email), today)
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, Error("You have already submitted a drawing today"))
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

	submissionID, err := queries.InsertSubmissionRecord(appCtx.DB, ctx, queries.InsertSubmissionRecordParams{
		UserID: requester.ID,
		Day:    today,
	})

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

	log.Printf("User %s successfully submitted drawing for %s", utils.MaskEmail(requester.Email), today)

	go func() {
		if err := notifications.NotifyFriendsOfSubmission(appCtx.DB, requester.ID, requester.Username, submissionID, appCtx.Config); err != nil {
			log.Printf("Failed to send friend notifications for user %s: %v", utils.MaskEmail(requester.Email), err)
		}
	}()

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Drawing submitted successfully",
		"day":      today,
		"imageUrl": imageURL,
		"id":       submissionID,
	})
}
