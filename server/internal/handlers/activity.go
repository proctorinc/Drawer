package handlers

import (
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"
	"net/http"

	"github.com/gin-gonic/gin"
)

// HandleGetActivity returns the user's activity feed (comments and reactions on their submissions)
func HandleGetActivity(c *gin.Context) {
	repo := middleware.GetDB(c)
	userID := middleware.GetUserID(c)
	ctx := c.Request.Context()
	cfg := middleware.GetConfig(c)

	lastReadID, err := db.GetLastReadActivityID(repo, ctx, userID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get last read activity id"})
		return
	}

	activities, err := db.GetActivityFeed(repo, ctx, userID, lastReadID, cfg)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity feed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"activities": activities})
}

// HandlePostActivity marks all activities up to the given activityId as read
func HandlePostActivity(c *gin.Context) {
	repo := middleware.GetDB(c)
	userID := middleware.GetUserID(c)
	ctx := c.Request.Context()

	var req struct {
		ActivityID string `json:"activityId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Missing or invalid activityId"})
		return
	}

	err := db.SetLastReadActivityID(repo, ctx, userID, req.ActivityID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update last read activity id"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
