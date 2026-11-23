package handlers

import (
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// TodaysPledgesResponse is whose side you and your friends took today, when the day's judge
// (the Grinch) asked: the app puts his hat on everyone who joined him.
type TodaysPledgesResponse struct {
	Joined  []string `json:"joined"`
	Refused []string `json:"refused"`
}

// HandleGetTodaysPledges lists who among you and your friends joined the Grinch today, and
// who turned him down. Both lists are empty on any other day.
func HandleGetTodaysPledges(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	today := utils.GetFormattedDate(time.Now())
	joined, refused, err := queries.GetDayPledges(appCtx.DB, c.Request.Context(), middleware.GetUserID(c), today)
	if err != nil {
		log.Printf("Error loading today's pledges: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load today's pledges"))
		return
	}
	c.JSON(http.StatusOK, TodaysPledgesResponse{Joined: joined, Refused: refused})
}

// grinchDaysFor is the days the Grinch judges during event, with userID's answer on each.
// Errors are logged and leave the list empty: it's only a garnish on the recap.
func grinchDaysFor(c *gin.Context, userID string, days events.DayRange) []queries.GrinchDay {
	appCtx := requestContext.GetCtx(c)
	grinchDays, err := queries.GetGrinchDays(appCtx.DB, c.Request.Context(), userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error loading Grinch days for user %s: %v", userID, err)
		return []queries.GrinchDay{}
	}
	return grinchDays
}
