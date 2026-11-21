package handlers

import (
	"database/sql"
	achievementsPkg "drawer-service-backend/internal/achievements"
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
	achievementService := achievementsPkg.NewAchievementService(appCtx.DB, c, requester.ID)

	err := achievementService.UpdateAchievementsOnce(requester.ID)

	if err != nil {
		log.Printf("Error running one-time achievement check for user %s: %v", requester.ID, err)
	}

	achievements, rewards, err := achievementService.GetAllAchievements(requester.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	achievements = achievementsPkg.MaskAll(visibleAchievements(c, achievements), false)

	c.JSON(http.StatusOK, AchievementsAndRewardsResponse{
		Achievements: achievements,
		Rewards:      rewards,
	})
}

// HandlerGetAchievementCatalog is every achievement there is, for the achievements page.
// Hidden ones and event stickers stay secret until they're earned, whether or not their
// event has started.
func HandlerGetAchievementCatalog(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := context.GetCtx(c)
	service := achievementsPkg.NewAchievementService(appCtx.DB, c, requester.ID)

	if err := service.UpdateAchievementsOnce(requester.ID); err != nil {
		log.Printf("Error running one-time achievement check for user %s: %v", requester.ID, err)
	}
	all, rewards, err := service.GetAllAchievements(requester.ID)
	if err != nil {
		log.Printf("Error fetching the achievement catalog for user %s: %v", requester.ID, err)
		c.JSON(http.StatusInternalServerError, Error("Failed to load achievements"))
		return
	}

	c.JSON(http.StatusOK, AchievementsAndRewardsResponse{
		Achievements: achievementsPkg.MaskAll(all, true),
		Rewards:      rewards,
	})
}

// HandlerMarkAchievementsCelebrated records that the player has seen these achievements
// celebrations, so they never replay, here or on another device. An admin viewing as someone
// else changes nothing: the player should still get to see their own.
func HandlerMarkAchievementsCelebrated(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.IDs) == 0 || len(body.IDs) > 100 {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Send the ids of the achievements you saw"))
		return
	}
	if middleware.GetImpersonator(c) != nil {
		c.Status(http.StatusNoContent)
		return
	}
	appCtx := context.GetCtx(c)
	if err := queries.MarkAchievementsCelebrated(appCtx.DB, c.Request.Context(), middleware.GetUserID(c), body.IDs); err != nil {
		log.Printf("Error marking achievements celebrated: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to mark achievements celebrated"))
		return
	}
	c.Status(http.StatusNoContent)
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
	// Whether they've watched their own celebrations is theirs alone
	for i := range achievements {
		achievements[i].Celebrated = false
	}
	achievements = achievementsPkg.MaskAll(visibleAchievements(c, achievements), false)

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
