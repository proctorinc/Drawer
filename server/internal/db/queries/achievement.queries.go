package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"log"
)

func GetAchievementsAndRewardsByUserID(repo *sql.DB, ctx context.Context, userId string) ([]models.Achievement, map[string]models.RewardUnlock, error) {
	query := `
		SELECT a.id, a.name, a.description, a.image_url, a.achievement_field, a.achievement_value, ua.created_at, r.id, r.name, r.description, r.created_at
		FROM achievements a
		LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND user_id = ?
		LEFT JOIN reward_unlocks r ON r.achievement_id = a.id
	`

	rows, err := repo.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	achievements := []models.Achievement{}
	rewards := map[string]models.RewardUnlock{}

	for rows.Next() {
		var achievement models.Achievement
		var rewardID, rewardName, rewardDescription sql.NullString
		var achievedAt, rewardCreatedAt sql.NullTime
		if err := rows.Scan(&achievement.ID, &achievement.Name, &achievement.Description, &achievement.ImageURL, &achievement.AchievementField, &achievement.AchievementValue, &achievedAt, &rewardID, &rewardName, &rewardDescription, &rewardCreatedAt); err != nil {
			return nil, nil, err
		}

		if achievedAt.Valid {
			achievement.AchievedAt = &achievedAt.Time
		}

		if rewardID.Valid && rewardName.Valid && rewardDescription.Valid && rewardCreatedAt.Valid {
			reward := models.RewardUnlock{
				ID:          rewardID.String,
				Name:        rewardName.String,
				Description: rewardDescription.String,
				CreatedAt:   rewardCreatedAt.Time,
			}
			achievement.Reward = &reward

			if achievedAt.Valid {
				rewards[reward.ID] = reward
			}
		}

		achievements = append(achievements, achievement)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	return achievements, rewards, nil
}

func UpdateUserAchievements(repo *sql.DB, ctx context.Context, userId string) error {
	achievements, err := GetIncompleteAchievements(repo, ctx, userId)

	if err != nil {
		log.Printf("Error getting all achievements for user %s: %v", userId, err)
		return err
	}

	log.Printf("Looping through %d achievements", len(achievements))

	for _, achievement := range achievements {
		log.Printf("Checking achievement %s", achievement.Name)

		// Check if its already been passed, if so skip
		pass, err := CheckAchievementCondition(repo, ctx, userId, achievement)

		if err != nil {
			log.Printf("Error checking achievement %s for user %s: %v", achievement.Name, userId, err)
			continue
		}

		if pass {
			log.Printf("Achievement passed, adding achievement to user profile %s", achievement.Name)
			err := InsertUserAchievement(repo, ctx, userId, achievement.ID)
			if err != nil {
				log.Printf("Error inserting achievement %s for user %s: %v", achievement.Name, userId, err)
			}
		}
	}

	return nil
}

func UpdateUserAchievementsByAchievementField(repo *sql.DB, ctx context.Context, userId string, achievementField []string) error {
	log.Print("Getting all achievements")
	achievements, err := GetIncompleteAchievementsByAchievementField(repo, ctx, userId, achievementField)

	if err != nil {
		log.Printf("Error getting all achievements for user %s: %v", userId, err)
		return err
	}

	log.Printf("Looping through %d achievements", len(achievements))

	for _, achievement := range achievements {
		log.Printf("Checking achievement %s", achievement.Name)

		// Check if its already been passed, if so skip
		pass, err := CheckAchievementCondition(repo, ctx, userId, achievement)

		if err != nil {
			log.Printf("Error checking achievement %s for user %s: %v", achievement.Name, userId, err)
			continue
		}

		// Find a way to cache the check result so it doesn't check everytime. Maybe every few hours? Maybe it checks up to the current day and it won't check until the next day? It would have to save this to the db

		log.Print("Checked achievement")

		if pass {
			log.Printf("Achievement passed, adding achievement to user profile %s", achievement.Name)
			err := InsertUserAchievement(repo, ctx, userId, achievement.ID)
			if err != nil {
				log.Printf("Error inserting achievement %s for user %s: %v", achievement.Name, userId, err)
			}
		}
	}

	return nil
}
