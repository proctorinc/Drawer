package handlers

import (
	stdcontext "context"
	"database/sql"
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"fmt"
	"log"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

// HandleGetActivity returns the user's last week of activity, newest first, and which
// friends have drawn today
func HandleGetActivity(c *gin.Context) {
	appCtx := context.GetCtx(c)
	userID := middleware.GetUserID(c)
	ctx := c.Request.Context()
	requester := middleware.GetUser(c)

	activities := []models.Activity{}
	for _, source := range []struct {
		name string
		get  func() ([]models.Activity, error)
	}{
		{"comments, reactions and friend requests", func() ([]models.Activity, error) {
			return queries.GetActivityFeed(appCtx.DB, ctx, userID, appCtx.Config)
		}},
		{"pokes", func() ([]models.Activity, error) { return queries.GetPokesReceived(appCtx.DB, ctx, userID) }},
		{"achievements", func() ([]models.Activity, error) { return queries.GetAchievementActivity(appCtx.DB, ctx, userID) }},
		{"level-ups", func() ([]models.Activity, error) { return getLevelUps(appCtx.DB, ctx, requester) }},
	} {
		found, err := source.get()
		if err != nil {
			log.Printf("HandleGetActivity: error getting %s for user %s: %v", source.name, userID, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity feed"})
			return
		}
		activities = append(activities, found...)
	}
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

// getLevelUps finds the levels the user reached in the last week. Levels aren't stored,
// so it replays the week's XP on top of everything before it.
func getLevelUps(repo *sql.DB, ctx stdcontext.Context, user models.User) ([]models.Activity, error) {
	since := time.Now().AddDate(0, 0, -7)
	before, err := queries.GetActivityCounts(repo, ctx, []string{user.ID}, queries.BeginningOfTime, since)
	if err != nil {
		return nil, err
	}
	events, err := queries.GetXPEventsSince(repo, ctx, user.ID, since)
	if err != nil {
		return nil, err
	}

	xp := xpFor(before[user.ID])
	level := levelForXP(xp).Level
	levelUps := []models.Activity{}
	for _, event := range events {
		xp += xpPerKind[event.Kind]
		if reached := levelForXP(xp).Level; reached > level {
			level = reached
			levelUps = append(levelUps, models.Activity{
				ID:     fmt.Sprintf("level-%d", level),
				User:   user,
				Action: models.ActivityActionLevelUp,
				Date:   event.At,
				Level:  level,
			})
		}
	}
	return levelUps, nil
}
