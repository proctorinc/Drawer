package handlers

import (
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/reactions"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type ActiveEventResponse struct {
	Event *events.ActiveEvent `json:"event"`
}

func HandleGetActiveEvent(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	now := events.Now(appCtx.Config)

	event, err := queries.GetActiveEvent(appCtx.DB, c.Request.Context(), now)
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusOK, ActiveEventResponse{Event: nil})
		return
	}
	if err != nil {
		log.Printf("Error fetching active event at %s: %v", now, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve active event"))
		return
	}

	activeEvent, err := eventWithProgress(c, event, now)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve active event"))
		return
	}
	c.JSON(http.StatusOK, ActiveEventResponse{Event: &activeEvent})
}

// eventWithProgress builds the event JSON with the signed-in user's doodled days.
func eventWithProgress(c *gin.Context, event models.Event, now time.Time) (events.ActiveEvent, error) {
	appCtx := requestContext.GetCtx(c)
	userID := middleware.GetUserID(c)
	days := events.Days(event)

	doodledDays, err := queries.GetUserSubmissionDays(appCtx.DB, c.Request.Context(), userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error fetching event %s progress for user %s: %v", event.Slug, userID, err)
		return events.ActiveEvent{}, err
	}

	activeEvent := events.NewActiveEvent(event, now)
	activeEvent.Progress = events.NewProgress(doodledDays)
	return activeEvent, nil
}

// eventFromSlug loads the :slug event, responding 404/500 and returning false if it can't.
func eventFromSlug(c *gin.Context) (models.Event, bool) {
	appCtx := requestContext.GetCtx(c)
	slug := c.Param("slug")

	event, err := queries.GetEventBySlug(appCtx.DB, c.Request.Context(), slug)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Event not found"))
		return models.Event{}, false
	}
	if err != nil {
		log.Printf("Error fetching event %s: %v", slug, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve event"))
		return models.Event{}, false
	}
	return event, true
}

type EventLeaderboardResponse struct {
	Entries []queries.EventLeaderboardEntry `json:"entries"`
}

// HandleGetEventLeaderboard ranks the signed-in user and their friends by doodles during the event.
func HandleGetEventLeaderboard(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	userID := middleware.GetUserID(c)

	event, ok := eventFromSlug(c)
	if !ok {
		return
	}

	days := events.Days(event)
	entries, err := queries.GetEventLeaderboard(appCtx.DB, c.Request.Context(), userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error fetching event %s leaderboard for user %s: %v", event.Slug, userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve leaderboard"))
		return
	}

	c.JSON(http.StatusOK, EventLeaderboardResponse{Entries: entries})
}

type EventRecapStats struct {
	Doodles           int `json:"doodles"`
	ReactionsReceived int `json:"reactionsReceived"`
	LongestStreak     int `json:"longestStreak"`
}

type EventRecapResponse struct {
	Event       events.ActiveEvent            `json:"event"`
	Submissions []models.UserPromptSubmission `json:"submissions"`
	Stats       EventRecapStats               `json:"stats"`
}

// HandleGetEventRecap returns the signed-in user's doodles and stats for an event.
func HandleGetEventRecap(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	userID := middleware.GetUserID(c)

	event, ok := eventFromSlug(c)
	if !ok {
		return
	}

	recapEvent, err := eventWithProgress(c, event, events.Now(appCtx.Config))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve recap"))
		return
	}

	days := events.Days(event)
	submissions, err := queries.GetUserSubmissionsInDays(appCtx.DB, ctx, appCtx.Config, userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error fetching event %s submissions for user %s: %v", event.Slug, userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve recap"))
		return
	}

	reactionsReceived, err := queries.CountReactionsReceived(appCtx.DB, ctx, userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error counting event %s reactions for user %s: %v", event.Slug, userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve recap"))
		return
	}

	c.JSON(http.StatusOK, EventRecapResponse{
		Event:       recapEvent,
		Submissions: submissions,
		Stats: EventRecapStats{
			Doodles:           recapEvent.Progress.Count,
			ReactionsReceived: reactionsReceived,
			LongestStreak:     events.LongestStreak(recapEvent.Progress.DoodledDays),
		},
	})
}

// isReactionAllowed accepts everyday catalog reactions, plus event-only ones (see
// reactions.json) while an event that lists them is active.
// Reactions given during an event stay stored (and displayed) after it ends.
func isReactionAllowed(c *gin.Context, reactionID string) (bool, error) {
	if reactions.IsValid(reactionID) {
		return true, nil
	}
	if !reactions.IsEventOnly(reactionID) {
		return false, nil
	}
	appCtx := requestContext.GetCtx(c)
	return queries.IsEventReactionAllowed(appCtx.DB, c.Request.Context(), reactionID, events.Now(appCtx.Config))
}
