package handlers

import (
	"drawer-service-backend/internal/achievements"
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
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

	c.JSON(http.StatusOK, AchievementsAndRewardsResponse{
		Achievements: achievements,
		Rewards:      rewards,
	})
}
