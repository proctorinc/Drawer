package handlers

import (
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"errors"
	"log"
	"net/http"

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

	activeEvent := events.NewActiveEvent(event, now)
	c.JSON(http.StatusOK, ActiveEventResponse{Event: &activeEvent})
}
