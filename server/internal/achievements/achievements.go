package achievements

import (
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/stats"
	"log"

	"github.com/gin-gonic/gin"
)

type RewardUnlockId string

var (
	CUSTOM_PROFILE_PIC RewardUnlockId = "CUSTOM_PROFILE_PIC"
)

type AchievementService struct {
	DB  *sql.DB
	Ctx *gin.Context
}

func NewAchievementService(db *sql.DB, ctx *gin.Context) *AchievementService {
	return &AchievementService{
		DB:  db,
		Ctx: ctx,
	}
}

func (as *AchievementService) InitializeWithRewards(cfg *config.Config) {
	rewards := map[RewardUnlockId]*models.RewardUnlock{
		CUSTOM_PROFILE_PIC: {
			ID:          string(CUSTOM_PROFILE_PIC),
			Name:        "Draw your own profile picture",
			Description: "First reward description",
		},
	}

	achievements := []models.Achievement{
		{
			ImageURL:         "",
			Name:             "2 week doodle streak",
			Description:      "Keep doodling every day for two consecutive weeks",
			Reward:           rewards[CUSTOM_PROFILE_PIC],
			AchievementField: string(stats.SUBMISSION_STREAK),
			AchievementValue: 14,
		},
		{
			ImageURL:         "",
			Name:             "First Doodle",
			Description:      "Submit your first drawing!",
			AchievementField: string(stats.SUBMISSION_TOTAL),
			AchievementValue: 1,
		},
		{
			ImageURL:         "",
			Name:             "First Comment",
			Description:      "Make your first comment on someone's drawing!",
			AchievementField: string(stats.COMMENT_TOTAL),
			AchievementValue: 1,
		},
		{
			ImageURL:         "",
			Name:             "First Reaction",
			Description:      "Make your first reaction to someone's drawing!",
			AchievementField: string(stats.REACTION_TOTAL),
			AchievementValue: 1,
		},
		{
			ImageURL:         "",
			Name:             "First friend",
			Description:      "Add your first friend!",
			AchievementField: string(stats.FRIEND_TOTAL),
			AchievementValue: 1,
		},
	}

	log.Print(achievements)
}

func (as *AchievementService) UpdateAchievementsOnce(userID string) error {
	ctx := as.Ctx.Request.Context()

	lastCheck, err := queries.GetLastUserAchievementCheck(as.DB, ctx, userID)

	if err != nil {
		log.Printf("Failed to get last user achievement check: %v", err)
	}

	log.Printf("Achievements last checked for user %s at %v", userID, lastCheck)

	// See if the user's achievements have been updated ever
	// This is to get all users up to date on their achievements on first load
	if lastCheck == nil {
		log.Println("User still needs to update their achievements")

		// If not, update them once
		err := queries.UpdateUserAchievements(as.DB, ctx, userID)

		if err != nil {
			log.Printf("Failed to update user achievements: %v", err)
			return err
		}

		err = queries.InsertLastUserAchievementCheck(as.DB, ctx, userID)

		if err != nil {
			log.Printf("Failed to insert last user achievement check: %v", err)
			return err
		}

	} else {
		log.Printf("User %s has already updated their achievements", userID)
	}

	return nil
}

func (as *AchievementService) UpdateAllAchievements(userId string) error {
	return queries.UpdateUserAchievements(as.DB, as.Ctx.Request.Context(), userId)
}

/* Check all submission achievements to see if a user has earned any */
func (as *AchievementService) UpdateSubmissionAchievements(userId string) error {
	return queries.UpdateUserAchievementsByAchievementField(as.DB, as.Ctx.Request.Context(), userId, []string{
		string(stats.SUBMISSION_STREAK),
		string(stats.SUBMISSION_TOTAL),
	})
}

/* Check all comment achievements to see if a user has earned any */
func (as *AchievementService) UpdateCommentAchievements(userId string) error {
	return queries.UpdateUserAchievementsByAchievementField(as.DB, as.Ctx.Request.Context(), userId, []string{
		string(stats.COMMENT_TOTAL),
	})
}

/* Check all reaction achievements to see if a user has earned any */
func (as *AchievementService) UpdateReactionAchievements(userId string) error {
	return queries.UpdateUserAchievementsByAchievementField(as.DB, as.Ctx.Request.Context(), userId, []string{
		string(stats.REACTION_TOTAL),
	})
}

/* Check all friend achievements to see if a user has earned any */
func (as *AchievementService) UpdateFriendAchievements(userId string) error {
	return queries.UpdateUserAchievementsByAchievementField(as.DB, as.Ctx.Request.Context(), userId, []string{
		string(stats.FRIEND_TOTAL),
	})
}
