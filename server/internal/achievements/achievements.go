package achievements

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/stats"
	"log"
	"slices"
	"time"
)

type RewardUnlockId string

var (
	CUSTOM_PROFILE_PIC RewardUnlockId = "CUSTOM_PROFILE_PIC"

	TURKEY_HAT RewardUnlockId = "TURKEY_HAT"

	FIRST_SNOW       RewardUnlockId = "FIRST_SNOW"
	CHRISTMAS_LIGHTS RewardUnlockId = "CHRISTMAS_LIGHTS"
	GOLDEN_SANTA_HAT RewardUnlockId = "GOLDEN_SANTA_HAT"
)

// decorations are the rewards worn on the avatar. Each is unlocked by one achievement
// (see the reward_unlocks seeds) and drawn by src/decorations/decorations.tsx.
var decorations = map[RewardUnlockId]bool{
	TURKEY_HAT: true,

	FIRST_SNOW:       true,
	CHRISTMAS_LIGHTS: true,
	GOLDEN_SANTA_HAT: true,

	// Achievement flair (migrations/1795131100_seed_achievement_decorations.up.sql)
	"PENCIL_EAR":    true,
	"BERET":         true,
	"CRAYON_CROWN":  true,
	"ORBIT":         true,
	"SWEATBAND":     true,
	"BLAZE":         true,
	"PROPELLER_CAP": true,
	"SPEECH_BUBBLE": true,
	"FOAM_FINGER":   true,
	"LIGHTBULB":     true,
	"JESTER_HAT":    true,
	"HEART_SWARM":   true,
	"PLUNGER_HAT":   true,
	"BAND_AIDS":     true,
	"APPLE_HAT":     true,
	"GILDED_FRAME":  true,
	"HALO":          true,
	"RAIN_CLOUD":    true,
	"CROWN":         true,
	"MYTHIC_WINGS":  true,

	// For a 0 from the Grinch (migrations/1795132610_seed_grinch.up.sql)
	"GRINCH_HEART": true,
	// For seeing every Grinch day through (migrations/1795132710_grinch_season.up.sql)
	"GRINCH_HAT": true,

	// Flair for the hard steps of a path (migrations/1795132100_seed_path_decorations.up.sql)
	"PALETTE":         true,
	"LAUREL_WREATH":   true,
	"BALLOONS":        true,
	"QUILL":           true,
	"GOLD_STARS":      true,
	"PLATINUM_PENCIL": true,
}

// IsDecoration reports whether a reward is a decoration, worn on the avatar one at a time
func IsDecoration(id RewardUnlockId) bool {
	return decorations[id]
}

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

		// Some goals move without the player doing anything here (reactions from friends,
		// a level from XP, a judge's score, a brand new achievement), so catch up on them now
		if achievement.AchievedAt == nil && pass && err == nil {
			if err := queries.InsertUserAchievement(as.DB, as.Ctx, userId, achievement.ID); err != nil {
				log.Printf("Error catching up on achievement %s for user %s: %v", achievement.ID, userId, err)
			} else {
				now := time.Now().UTC()
				achievement.AchievedAt = &now
				if achievement.Reward != nil {
					rewards[achievement.Reward.ID] = *achievement.Reward
				}
			}
		}

		achievement.Progress = val

		// Streak stickers are earned by the longest run, but an unearned one should
		// show the streak that's going now, with the best run as a footnote.
		if achievement.AchievedAt == nil && achievement.AchievementField == string(stats.SUBMISSION_STREAK) {
			if current, err := queries.CalculateSubmissionActiveStreak(as.DB, as.Ctx, userId); err == nil {
				if val > current {
					best := val
					achievement.Best = &best
				}
				achievement.Progress = current
			}
		}

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
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, append([]string{
		string(stats.SUBMISSION_STREAK),
		string(stats.SUBMISSION_TOTAL),
		string(stats.EVENT_SUBMISSION_TOTAL),
		string(stats.EVENT_COUNTDOWN_TOTAL),
		string(stats.THANKSGIVING_TOTAL),
	}, slices.Concat(stats.EVENT_DAY_FIELDS, stats.GRINCH_PLEDGE_FIELDS)...)) // drawing the day's doodle also locks in the answer to the Grinch
}

/* Check the AI judge achievements, after one of the user's doodles was reviewed */
func (as *AchievementService) UpdateJudgeAchievements(userId string) error {
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, slices.Concat(stats.AI_FIELDS, stats.GRINCH_SCORE_FIELDS))
}

/* Check all comment achievements to see if a user has earned any */
func (as *AchievementService) UpdateCommentAchievements(userId string) error {
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, []string{
		string(stats.COMMENT_TOTAL),
		string(stats.EVENT_COMMENT_TOTAL),
	})
}

/* Check all reaction achievements to see if a user has earned any */
func (as *AchievementService) UpdateReactionAchievements(userId string) error {
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, []string{
		string(stats.REACTION_TOTAL),
		string(stats.EVENT_REACTION_TOTAL),
		string(stats.EVENT_FRIENDS_CHEERED),
	})
}

/* Check all friend achievements to see if a user has earned any */
func (as *AchievementService) UpdateFriendAchievements(userId string) error {
	return as.updateUserAchievementsByAchievementField(as.DB, as.Ctx, userId, []string{
		string(stats.FRIEND_TOTAL),
	})
}

func (as *AchievementService) updateUserAchievementsByAchievementField(repo *sql.DB, ctx context.Context, userId string, achievementField []string) error {
	// Everything earns XP, so any of it can level you up
	achievementField = append(achievementField, string(stats.LEVEL))
	achievements, err := queries.GetIncompleteAchievementsByAchievementField(repo, ctx, userId, achievementField)

	if err != nil {
		log.Printf("Error getting all achievements for user %s: %v", userId, err)
		return err
	}

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

// Mask withholds what a secret achievement is until it's earned: a hidden achievement,
// or with events set, an event sticker. The id stays, so the app can tell when it's earned.
func Mask(achievement models.Achievement, events bool) models.Achievement {
	if achievement.AchievedAt != nil {
		return achievement
	}
	isEvent := achievement.EventSlug != nil
	if !achievement.Hidden && !(events && isEvent) {
		return achievement
	}
	masked := models.Achievement{
		ID:       achievement.ID,
		Name:     "???",
		Category: achievement.Category,
		Hidden:   achievement.Hidden,
		Secret:   true,
		// Where it sits on its path isn't the secret, just what it takes
		Path:     achievement.Path,
		PathStep: achievement.PathStep,
	}
	// A live event's stickers are on its page anyway, but which event stays a surprise
	if isEvent {
		masked.Category = "events"
	}
	return masked
}

// MaskAll masks each achievement (see Mask)
func MaskAll(all []models.Achievement, events bool) []models.Achievement {
	masked := make([]models.Achievement, len(all))
	for i, a := range all {
		masked[i] = Mask(a, events)
	}
	return masked
}
