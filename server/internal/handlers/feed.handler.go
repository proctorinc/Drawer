package handlers

import (
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// feedDaysPerPage is today plus a few days before it on the first page
const feedDaysPerPage = 4

func isDay(value string) bool {
	_, err := time.Parse("2006-01-02", value)
	return err == nil
}

// HandleGetFeed returns a page of you and your friends' doodles. Pass the previous page's
// nextBefore as ?before= for the next one.
func HandleGetFeed(c *gin.Context) {
	appCtx := context.GetCtx(c)
	userID := middleware.GetUserID(c)

	before := c.Query("before")
	if before != "" && !isDay(before) {
		c.JSON(http.StatusBadRequest, Error("before must be a YYYY-MM-DD day"))
		return
	}

	page, err := queries.GetFeedPage(appCtx.DB, c.Request.Context(), appCtx.Config, userID, before, feedDaysPerPage)
	if err != nil {
		log.Printf("HandleGetFeed: error getting feed for user %s before %q: %v", userID, before, err)
		c.JSON(http.StatusInternalServerError, Error("Failed to get feed"))
		return
	}
	c.JSON(http.StatusOK, page)
}

// HandleGetFeedDay returns you and your friends' doodles from one day
func HandleGetFeedDay(c *gin.Context) {
	appCtx := context.GetCtx(c)
	userID := middleware.GetUserID(c)

	day := c.Param("day")
	if !isDay(day) {
		c.JSON(http.StatusBadRequest, Error("day must be YYYY-MM-DD"))
		return
	}

	submissions, err := queries.GetFeedDay(appCtx.DB, c.Request.Context(), appCtx.Config, userID, day)
	if err != nil {
		log.Printf("HandleGetFeedDay: error getting %s for user %s: %v", day, userID, err)
		c.JSON(http.StatusInternalServerError, Error("Failed to get feed"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"submissions": submissions})
}
