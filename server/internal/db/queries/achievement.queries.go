package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"time"
)

func GetAchievementsAndRewardsByUserID(repo *sql.DB, ctx context.Context, userId string) ([]models.Achievement, map[string]models.RewardUnlock, error) {
	query := `
		SELECT a.id, a.name, a.description, a.image_url, a.achievement_field, a.achievement_value, ua.created_at, r.id, r.name, r.description, r.created_at, e.slug
		FROM achievements a
		LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND user_id = ?
		LEFT JOIN reward_unlocks r ON r.achievement_id = a.id
		LEFT JOIN event_achievements ea ON ea.achievement_id = a.id
		LEFT JOIN events e ON e.id = ea.event_id
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
		var rewardID, rewardName, rewardDescription, eventSlug sql.NullString
		var achievedAt, rewardCreatedAt sql.NullTime
		if err := rows.Scan(&achievement.ID, &achievement.Name, &achievement.Description, &achievement.ImageURL, &achievement.AchievementField, &achievement.AchievementValue, &achievedAt, &rewardID, &rewardName, &rewardDescription, &rewardCreatedAt, &eventSlug); err != nil {
			return nil, nil, err
		}

		if eventSlug.Valid {
			achievement.EventSlug = &eventSlug.String
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

// GetAchievementActivity returns the achievements the user and their friends unlocked in the last week as activity
func GetAchievementActivity(repo *sql.DB, ctx context.Context, userID string) ([]models.Activity, error) {
	var by models.User
	var achievement models.Achievement
	var unlockedAt time.Time
	activities := []models.Activity{}
	err := queryEach(repo, ctx, `
		SELECT `+activityUserColumns("u")+`, a.id, a.name, a.description, a.image_url, a.achievement_field, a.achievement_value, ua.created_at
		FROM user_achievements ua
		JOIN achievements a ON a.id = ua.achievement_id
		JOIN users u ON u.id = ua.user_id
		WHERE ua.created_at >= `+activityWindow+` AND (ua.user_id = ? OR EXISTS (
			SELECT 1 FROM friendships f WHERE f.state = 'accepted'
				AND ((f.user1 = ? AND f.user2 = ua.user_id) OR (f.user2 = ? AND f.user1 = ua.user_id))))`,
		[]any{userID, userID, userID},
		append(activityUserDest(&by), &achievement.ID, &achievement.Name, &achievement.Description, &achievement.ImageURL,
			&achievement.AchievementField, &achievement.AchievementValue, &unlockedAt),
		func() {
			unlocked := achievement
			unlocked.AchievedAt = &unlockedAt
			activities = append(activities, models.Activity{
				ID:          "achievement-" + by.ID + "-" + achievement.ID,
				User:        by,
				Action:      models.ActivityActionAchievement,
				Date:        unlockedAt,
				Achievement: &unlocked,
			})
		})
	return activities, err
}
