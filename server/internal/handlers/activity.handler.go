package handlers

import (
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"log"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

// HandleGetActivity returns the user's activity (friends' comments and reactions on their drawings,
// plus pokes they got) and which friends have drawn today
func HandleGetActivity(c *gin.Context) {
	appCtx := context.GetCtx(c)
	userID := middleware.GetUserID(c)
	ctx := c.Request.Context()
	requester := middleware.GetUser(c)

	activities, err := queries.GetActivityFeed(appCtx.DB, ctx, userID, appCtx.Config)
	if err != nil {
		log.Printf("HandleGetActivity: error getting activity feed for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity feed"})
		return
	}

	pokes, err := queries.GetPokesReceived(appCtx.DB, ctx, userID)
	if err != nil {
		log.Printf("HandleGetActivity: error getting pokes for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity feed"})
		return
	}
	activities = append(activities, pokes...)
	sort.SliceStable(activities, func(i, j int) bool {
		return activities[i].Date.After(activities[j].Date)
	})

	seenAt, err := queries.GetActivitySeenAt(appCtx.DB, ctx, userID)
	if err != nil {
		log.Printf("HandleGetActivity: error getting seenAt for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity feed"})
		return
	}
	for i := range activities {
		activities[i].IsRead = !activities[i].Date.After(seenAt)
	}

	pokedToday, err := queries.GetPokeesOn(appCtx.DB, ctx, userID, utils.GetFormattedDate(time.Now()))
	if err != nil {
		log.Printf("HandleGetActivity: error getting today's pokes for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity feed"})
		return
	}

	// --- Add friends + submission status ---
	type FriendSubmissionStatus struct {
		User              models.User `json:"user"`
		HasSubmittedToday bool        `json:"hasSubmittedToday"`
		PokedToday        bool        `json:"pokedToday"`
	}

	friendIDs, err := queries.GetUserFriends(appCtx.DB, ctx, userID)
	if err != nil {
		log.Printf("HandleGetActivity: error getting friends for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get friends"})
		return
	}

	friendIDs = append(friendIDs, requester.ID)

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
			User: models.User{
				ID:         friendUser.ID,
				Username:   friendUser.Username,
				Email:      friendUser.Email,
				CreatedAt:  friendUser.CreatedAt,
				AvatarType: friendUser.AvatarType,
				AvatarURL:  friendUser.AvatarURL,
			},
			HasSubmittedToday: hasSubmitted,
			PokedToday:        pokedToday[fid],
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"activities": activities,
		"friends":    friends,
	})
}

// HandlePostActivity marks all activity up to seenAt (the newest activity's date) as read
func HandlePostActivity(c *gin.Context) {
	appCtx := context.GetCtx(c)
	userID := middleware.GetUserID(c)
	ctx := c.Request.Context()

	var req struct {
		SeenAt time.Time `json:"seenAt" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Missing or invalid seenAt"})
		return
	}

	if err := queries.SetActivitySeenAt(appCtx.DB, ctx, userID, req.SeenAt); err != nil {
		log.Printf("HandlePostActivity: saving seenAt for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark activity read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "marked read"})
}
