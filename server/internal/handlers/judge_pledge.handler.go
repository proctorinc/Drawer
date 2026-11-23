package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/ai"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// todaysPledge is the signed-in player's answer to today's judge, when it's one that scores
// backwards (the Grinch); nil otherwise, or if they haven't answered. Errors are logged and
// treated as no answer: it's only a nicety on the drawing page.
func todaysPledge(c *gin.Context, p models.AIPersonality) *bool {
	if !p.ScoresBackwards {
		return nil
	}
	appCtx := requestContext.GetCtx(c)
	today := utils.GetFormattedDate(time.Now())
	pledge, err := queries.GetJudgePledge(appCtx.DB, c.Request.Context(), middleware.GetUserID(c), today)
	if err != nil {
		log.Printf("Error loading today's judge pledge: %v", err)
	}
	return pledge
}

// canPledge reports whether today's judge is asking the signed-in player to pick a side and
// they still can: it scores backwards and they haven't drawn yet.
func canPledge(c *gin.Context, p models.AIPersonality) bool {
	if !p.ScoresBackwards {
		return false
	}
	appCtx := requestContext.GetCtx(c)
	drawn, err := queries.HasDrawnDay(appCtx.DB, c.Request.Context(), middleware.GetUserID(c), utils.GetFormattedDate(time.Now()))
	if err != nil {
		log.Printf("Error checking for today's doodle: %v", err)
		return false
	}
	return !drawn
}

// lastVisitHistory is what the Grinch remembers of the signed-in player's last visit before
// today, for his intro. Errors are logged and treated as a first visit.
func lastVisitHistory(c *gin.Context, today string) ai.IntroHistory {
	appCtx := requestContext.GetCtx(c)
	joined, score, err := queries.GetLastJudgePledge(appCtx.DB, c.Request.Context(), middleware.GetUserID(c), today)
	if err != nil {
		log.Printf("Error loading the last judge pledge: %v", err)
	}
	return ai.HistoryFor(joined, score)
}

// HandleSaveJudgePledge answers today's judge when it's one that scores backwards (the Grinch)
// and his intro asked you to join his plot: {"joined": true} to join him, false to refuse.
// You can change your mind until you draw: 409 after that, and 400 on a day he isn't judging.
func HandleSaveJudgePledge(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()

	var body struct {
		Joined *bool `json:"joined"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Joined == nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Say whether you joined: {\"joined\": true or false}"))
		return
	}

	p, err := ai.PickPersonality(appCtx.DB, ctx, appCtx.Config)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Printf("Error picking today's AI judge: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to save your answer"))
		return
	}
	if err != nil || !p.ScoresBackwards {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Today's judge isn't asking"))
		return
	}

	eventID := ""
	event, err := queries.GetActiveEvent(appCtx.DB, ctx, events.Now(appCtx.Config))
	if err == nil {
		eventID = event.ID
	} else if !errors.Is(err, sql.ErrNoRows) {
		log.Printf("Error loading the active event for a judge pledge: %v", err)
	}

	today := utils.GetFormattedDate(time.Now())
	err = queries.SaveJudgePledge(appCtx.DB, ctx, middleware.GetUserID(c), today, p.ID, eventID, *body.Joined)
	if errors.Is(err, queries.ErrPledgeAfterDrawing) {
		c.AbortWithStatusJSON(http.StatusConflict, Error("You've already drawn today's doodle"))
		return
	}
	if err != nil {
		log.Printf("Error saving judge pledge: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to save your answer"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"joined": *body.Joined})
}
