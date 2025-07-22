package handlers

import (
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"net/http"
	"time"

	"log"

	"github.com/gin-gonic/gin"
)

// HandleGetActivity returns the user's activity feed (comments and reactions on their submissions)
func HandleGetActivity(c *gin.Context) {
	appCtx := context.GetCtx(c)
	userID := middleware.GetUserID(c)
	ctx := c.Request.Context()

	lastReadID, err := queries.GetLastReadActivityID(appCtx.DB, ctx, userID)
	if err != nil {
		log.Printf("HandleGetActivity: error getting lastReadID for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get last read activity id"})
		return
	}

	activities, err := queries.GetActivityFeed(appCtx.DB, ctx, userID, lastReadID, appCtx.Config)
	if err != nil {
		log.Printf("HandleGetActivity: error getting activity feed for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity feed"})
		return
	}

	// Filter out today's activity if the user hasn't submitted today
	hasSubmittedToday, err := queries.CheckUserSubmittedToday(appCtx.DB, ctx, userID)
	if err != nil {
		log.Printf("HandleGetActivity: error checking submission status for user %s: %v", userID, err)
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
		log.Printf("HandleGetActivity: filtered activities for user %s, now %d activities", userID, len(activities))
	}

	// --- Add friends + submission status ---
	type FriendSubmissionStatus struct {
		User      struct {
			ID        string    `json:"id"`
			Username  string    `json:"username"`
			Email     string    `json:"email"`
			CreatedAt time.Time `json:"createdAt"`
		} `json:"user"`
		HasSubmittedToday bool `json:"hasSubmittedToday"`
	}

	friendIDs, err := queries.GetUserFriends(appCtx.DB, ctx, userID)
	if err != nil {
		log.Printf("HandleGetActivity: error getting friends for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get friends"})
		return
	}

	friends := []FriendSubmissionStatus{}
	for _, fid := range friendIDs {
		friendUser, err := queries.GetUserByID(appCtx.DB, ctx, fid)
		if err != nil || friendUser == nil {
			log.Printf("HandleGetActivity: skipping friend %s (not found or error)", fid)
			continue // skip if not found
		}
		hasSubmitted, err := queries.CheckUserSubmittedToday(appCtx.DB, ctx, fid)
		if err != nil {
			hasSubmitted = false // fallback
		}
		friends = append(friends, FriendSubmissionStatus{
			User: struct {
				ID        string    `json:"id"`
				Username  string    `json:"username"`
				Email     string    `json:"email"`
				CreatedAt time.Time `json:"createdAt"`
			}{
				ID:        friendUser.ID,
				Username:  friendUser.Username,
				Email:     friendUser.Email,
				CreatedAt: friendUser.CreatedAt,
			},
			HasSubmittedToday: hasSubmitted,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"activities": activities,
		"friends": friends,
	})
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
