package achievements

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/stats"
	"log"
)

type RewardUnlockId string

var (
	CUSTOM_PROFILE_PIC RewardUnlockId = "CUSTOM_PROFILE_PIC"
)

type AchievementService struct {
	DB           *sql.DB
	Ctx          context.Context
	StatsService stats.StatsService
}

func NewAchievementService(db *sql.DB, ctx context.Context, userId string) *AchievementService {
	return &AchievementService{
		DB:           db,
		Ctx:          ctx,
		StatsService: *stats.NewStatsService(db, ctx, userId),
	}
}

// func (as *AchievementService) InitializeWithRewards(cfg *config.Config) {
// 	rewards := map[RewardUnlockId]*models.RewardUnlock{
// 		CUSTOM_PROFILE_PIC: {
// 			ID:          string(CUSTOM_PROFILE_PIC),
// 			Name:        "Draw your own profile picture",
// 			Description: "First reward description",
// 		},
// 	}

// 	achievements := []models.Achievement{
// 		{
// 			ImageURL:         "",
// 			Name:             "2 week doodle streak",
// 			Description:      "Keep doodling every day for two consecutive weeks",
// 			Reward:           rewards[CUSTOM_PROFILE_PIC],
// 			AchievementField: string(stats.SUBMISSION_STREAK),
// 			AchievementValue: 14,
// 		},
// 		{
// 			ImageURL:         "",
// 			Name:             "First Doodle",
// 			Description:      "Submit your first drawing!",
// 			AchievementField: string(stats.SUBMISSION_TOTAL),
// 			AchievementValue: 1,
// 		},
// 		{
// 			ImageURL:         "",
// 			Name:             "First Comment",
// 			Description:      "Make your first comment on someone's drawing!",
// 			AchievementField: string(stats.COMMENT_TOTAL),
// 			AchievementValue: 1,
// 		},
// 		{
// 			ImageURL:         "",
// 			Name:             "First Reaction",
// 			Description:      "Make your first reaction to someone's drawing!",
// 			AchievementField: string(stats.REACTION_TOTAL),
// 			AchievementValue: 1,
// 		},
// 		{
// 			ImageURL:         "",
// 			Name:             "First friend",
// 			Description:      "Add your first friend!",
// 			AchievementField: string(stats.FRIEND_TOTAL),
// 			AchievementValue: 1,
// 		},
// 	}

// 	log.Print(achievements)
// }

func (as *AchievementService) GetAllAchievements(userId string) ([]models.Achievement, map[string]models.RewardUnlock, error) {
	achievements, rewards, err := queries.GetAchievementsAndRewardsByUserID(as.DB, as.Ctx, userId)
	var updatedAchievements []models.Achievement
	if err != nil {
		return nil, nil, err
	}

	for _, achievement := range achievements {
		val, pass, err := as.StatsService.CheckStatCompletion(userId, achievement)

		if err != nil {
			log.Printf("Failed to check stat completion for achievement %s: %v", achievement.Name, err)
			achievement.Progress = 0
		}

		if achievement.AchievedAt == nil && pass == true {
			log.Printf("Issue for achievement %s: has passed, but no achieved date", achievement.Name)
		}

		achievement.Progress = val
		updatedAchievements = append(updatedAchievements, achievement)
	}

	return updatedAchievements, rewards, nil
}

func (as *AchievementService) UpdateAchievementsOnce(userId string) error {
	lastCheck, err := queries.GetLastUserAchievementCheck(as.DB, as.Ctx, userId)

	if err != nil {
		log.Printf("Failed to get last user achievement check: %v", err)
	}

	log.Printf("Achievements last checked for user %s at %v", userId, lastCheck)

	// See if the user's achievements have been updated ever
	// This is to get all users up to date on their achievements on first load
	if lastCheck == nil {
		log.Println("User still needs to update their achievements")

		// If not, update them once
		achievements, err := queries.GetIncompleteAchievements(as.DB, as.Ctx, userId)

		if err != nil {
			log.Printf("Failed to update user achievements: %v", err)
			return err
		}

		for _, achievement := range achievements {
			_, pass, err := as.StatsService.CheckStatCompletion(userId, achievement)

			if err != nil {
				continue
			}

			if pass {
				err := queries.InsertUserAchievement(as.DB, as.Ctx, userId, achievement.ID)
				if err != nil {
					log.Printf("Error inserting achievement %s for user %s: %v", achievement.Name, userId, err)
				}
			}
		}

		err = queries.InsertLastUserAchievementCheck(as.DB, as.Ctx, userId)

		if err != nil {
			log.Printf("Failed to insert last user achievement check: %v", err)
			return err
		}

	} else {
		log.Printf("User %s has already updated their achievements", userId)
	}

	return nil
}

/* Check all submission achievements to see if a user has earned any */
func (as *AchievementService) UpdateSubmissionAchievements(userId string) error {
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, []string{
		string(stats.SUBMISSION_STREAK),
		string(stats.SUBMISSION_TOTAL),
	})
}

/* Check all comment achievements to see if a user has earned any */
func (as *AchievementService) UpdateCommentAchievements(userId string) error {
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, []string{
		string(stats.COMMENT_TOTAL),
	})
}

/* Check all reaction achievements to see if a user has earned any */
func (as *AchievementService) UpdateReactionAchievements(userId string) error {
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, []string{
		string(stats.REACTION_TOTAL),
	})
}

/* Check all friend achievements to see if a user has earned any */
func (as *AchievementService) UpdateFriendAchievements(userId string) error {
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, []string{
		string(stats.FRIEND_TOTAL),
	})
}

func (as *AchievementService) updateUserAchievementsByAchievementField(repo *sql.DB, ctx context.Context, userId string, achievementField []string) error {
	log.Print("Getting all achievements")
	achievements, err := queries.GetIncompleteAchievementsByAchievementField(repo, ctx, userId, achievementField)

	if err != nil {
		log.Printf("Error getting all achievements for user %s: %v", userId, err)
		return err
	}

	log.Printf("Looping through %d achievements", len(achievements))

	for _, achievement := range achievements {
		_, pass, err := as.StatsService.CheckStatCompletion(userId, achievement)

		if err != nil {
			continue
		}

		if pass {
			err := queries.InsertUserAchievement(as.DB, ctx, userId, achievement.ID)
			if err != nil {
				log.Printf("Error inserting achievement %s for user %s: %v", achievement.Name, userId, err)
			}
		}
	}

	return nil
}
