package handlers

import (
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// HandleGetActivity returns the user's activity feed (comments and reactions on their submissions)
func HandleGetActivity(c *gin.Context) {
	appCtx := context.GetCtx(c)
	userID := middleware.GetUserID(c)
	ctx := c.Request.Context()

	lastReadID, err := queries.GetLastReadActivityID(appCtx.DB, ctx, userID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get last read activity id"})
		return
	}

	activities, err := queries.GetActivityFeed(appCtx.DB, ctx, userID, lastReadID, appCtx.Config)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity feed"})
		return
	}

	// Filter out today's activity if the user hasn't submitted today
	hasSubmittedToday, err := queries.CheckUserSubmittedToday(appCtx.DB, ctx, userID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to check submission status"})
		return
	}

	if !hasSubmittedToday {
		todayStr := utils.GetFormattedDate(time.Now())
		filtered := activities[:0]

		for _, act := range activities {
			if utils.GetFormattedDate(act.Date) != todayStr {
				filtered = append(filtered, act)
			}
		}
		activities = filtered
	}

	c.JSON(http.StatusOK, gin.H{"activities": activities})
}

// HandlePostActivity marks all activities up to the given activityId as read
func HandlePostActivity(c *gin.Context) {
	appCtx := context.GetCtx(c)
	userID := middleware.GetUserID(c)
	ctx := c.Request.Context()

	var req struct {
		ActivityID string `json:"activityId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Missing or invalid activityId"})
		return
	}

	err := queries.SetLastReadActivityID(appCtx.DB, ctx, userID, req.ActivityID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update last read activity id"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
