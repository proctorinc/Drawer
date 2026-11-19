package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/achievements"
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/middleware"
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AchievementsAndRewardsResponse struct {
	Achievements []models.Achievement           `json:"achievements"`
	Rewards      map[string]models.RewardUnlock `json:"rewards"`
}

func HandlerGetMyAchievements(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := context.GetCtx(c)
	achievementService := achievements.NewAchievementService(appCtx.DB, c, requester.ID)

	err := achievementService.UpdateAchievementsOnce(requester.ID)

	if err != nil {
		log.Printf("Error running one-time achievement check for user %s: %v", requester.ID, err)
	}

	achievements, rewards, err := achievementService.GetAllAchievements(requester.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	achievements = visibleAchievements(c, achievements)

	c.JSON(http.StatusOK, AchievementsAndRewardsResponse{
		Achievements: achievements,
		Rewards:      rewards,
	})
}

func HandlerGetUserAchievements(c *gin.Context) {
	userId := c.Param("id")
	appCtx := context.GetCtx(c)
	ctx := c.Request.Context()

	achievements, rewards, err := queries.GetAchievementsAndRewardsByUserID(appCtx.DB, ctx, userId)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	achievements = visibleAchievements(c, achievements)

	c.JSON(http.StatusOK, AchievementsAndRewardsResponse{
		Achievements: achievements,
		Rewards:      rewards,
	})
}

// visibleAchievements drops event stickers that can't be earned right now: an event's
// stickers stay hidden until it starts, and once it's over only the earned ones remain.
func visibleAchievements(c *gin.Context, all []models.Achievement) []models.Achievement {
	appCtx := context.GetCtx(c)
	liveSlug := ""
	event, err := queries.GetActiveEvent(appCtx.DB, c.Request.Context(), events.Now(appCtx.Config))
	if err == nil {
		liveSlug = event.Slug
	} else if !errors.Is(err, sql.ErrNoRows) {
		log.Printf("Error fetching active event for achievements: %v", err)
	}

	visible := make([]models.Achievement, 0, len(all))
	for _, a := range all {
		if a.EventSlug == nil || a.AchievedAt != nil || *a.EventSlug == liveSlug {
			visible = append(visible, a)
		}
	}
	return visible
}
