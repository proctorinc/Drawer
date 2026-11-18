package handlers

import (
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// AdminEvent is an event as admins see and edit it.
type AdminEvent struct {
	ID            string    `json:"id"`
	Slug          string    `json:"slug"`
	Name          string    `json:"name"`
	Theme         string    `json:"theme"`
	StartsAt      time.Time `json:"startsAt"`
	EndsAt        time.Time `json:"endsAt"` // Exclusive
	CountdownDays *int      `json:"countdownDays"`
	Reactions     []string  `json:"reactions"`
}

func newAdminEvent(event models.Event) AdminEvent {
	reactions := event.Reactions
	if reactions == nil {
		reactions = []string{}
	}
	return AdminEvent{
		ID:            event.ID,
		Slug:          event.Slug,
		Name:          event.Name,
		Theme:         event.Theme,
		StartsAt:      event.StartsAt.UTC(),
		EndsAt:        event.EndsAt.UTC(),
		CountdownDays: event.CountdownDays,
		Reactions:     reactions,
	}
}

func HandleAdminListEvents(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)

	list, err := queries.ListEvents(appCtx.DB, c.Request.Context())
	if err != nil {
		log.Printf("Error listing events: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to list events"))
		return
	}

	response := make([]AdminEvent, 0, len(list))
	for _, event := range list {
		response = append(response, newAdminEvent(event))
	}
	c.JSON(http.StatusOK, gin.H{"events": response})
}

func HandleAdminCreateEvent(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)

	event, ok := bindEventInput(c, "")
	if !ok {
		return
	}

	created, err := queries.CreateEvent(appCtx.DB, c.Request.Context(), event)
	if err != nil {
		log.Printf("Error creating event %s: %v", event.Slug, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to create event"))
		return
	}
	c.JSON(http.StatusCreated, newAdminEvent(created))
}

func HandleAdminUpdateEvent(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	id := c.Param("id")

	event, ok := bindEventInput(c, id)
	if !ok {
		return
	}
	event.ID = id

	err := queries.UpdateEvent(appCtx.DB, c.Request.Context(), event)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Event not found"))
		return
	}
	if err != nil {
		log.Printf("Error updating event %s: %v", id, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to update event"))
		return
	}
	c.JSON(http.StatusOK, newAdminEvent(event))
}

// bindEventInput parses and validates the request body, rejecting a slug that another event
// (other than eventID) already uses. It responds and returns false on failure.
func bindEventInput(c *gin.Context, eventID string) (models.Event, bool) {
	appCtx := requestContext.GetCtx(c)

	var input events.EventInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid event: "+err.Error()))
		return models.Event{}, false
	}

	event, err := input.ToEvent()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error(err.Error()))
		return models.Event{}, false
	}

	taken, err := queries.IsEventSlugTaken(appCtx.DB, c.Request.Context(), event.Slug, eventID)
	if err != nil {
		log.Printf("Error checking event slug %s: %v", event.Slug, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to save event"))
		return models.Event{}, false
	}
	if taken {
		c.AbortWithStatusJSON(http.StatusConflict, Error("An event with this slug already exists"))
		return models.Event{}, false
	}

	return event, true
}
