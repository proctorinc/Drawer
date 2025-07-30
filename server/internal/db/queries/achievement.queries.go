package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
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
