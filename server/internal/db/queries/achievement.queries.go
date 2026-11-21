package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"strings"
	"time"
)

func GetAchievementsAndRewardsByUserID(repo *sql.DB, ctx context.Context, userId string) ([]models.Achievement, map[string]models.RewardUnlock, error) {
	query := `
		SELECT a.id, a.name, a.description, a.image_url, a.achievement_field, a.achievement_value, ua.created_at, ua.celebrated_at, r.id, r.name, r.description, r.created_at, e.slug, a.category, a.hidden, a.xp
		FROM achievements a
		LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND user_id = ?
		LEFT JOIN reward_unlocks r ON r.achievement_id = a.id
		LEFT JOIN event_achievements ea ON ea.achievement_id = a.id
		LEFT JOIN events e ON e.id = ea.event_id
		ORDER BY a.achievement_field, a.achievement_value
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
		var achievedAt, celebratedAt, rewardCreatedAt sql.NullTime
		if err := rows.Scan(&achievement.ID, &achievement.Name, &achievement.Description, &achievement.ImageURL, &achievement.AchievementField, &achievement.AchievementValue, &achievedAt, &celebratedAt, &rewardID, &rewardName, &rewardDescription, &rewardCreatedAt, &eventSlug, &achievement.Category, &achievement.Hidden, &achievement.XP); err != nil {
			return nil, nil, err
		}

		if eventSlug.Valid {
			achievement.EventSlug = &eventSlug.String
		}

		if achievedAt.Valid {
			achievement.AchievedAt = &achievedAt.Time
		}
		achievement.Celebrated = celebratedAt.Valid

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

// MarkAchievementsCelebrated records that the player has been shown these achievements being
// earned, so no device plays them again. Ids they haven't earned, or already celebrated, are
// left alone.
func MarkAchievementsCelebrated(repo *sql.DB, ctx context.Context, userID string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	args := make([]any, 0, len(ids)+1)
	args = append(args, userID)
	for _, id := range ids {
		args = append(args, id)
	}
	_, err := repo.ExecContext(ctx, `
		UPDATE user_achievements SET celebrated_at = CURRENT_TIMESTAMP
		WHERE user_id = ? AND celebrated_at IS NULL
			AND achievement_id IN (?`+strings.Repeat(", ?", len(ids)-1)+`)`, args...)
	return err
}

// friendAchievementPreview is how many of a friend's day of unlocks their card shows
const friendAchievementPreview = 3

// GetAchievementActivity returns the achievements the user and their friends unlocked in
// the last week as activity. Each of yours is its own row; a friend's are folded into one
// row per friend per day, carrying how many and the newest few.
func GetAchievementActivity(repo *sql.DB, ctx context.Context, userID string) ([]models.Activity, error) {
	var by models.User
	var achievement models.Achievement
	var eventSlug sql.NullString
	var unlockedAt time.Time
	activities := []models.Activity{}
	friendDays := map[string]int{}
	err := queryEach(repo, ctx, `
		SELECT `+activityUserColumns("u")+`, a.id, a.name, a.description, a.image_url, a.achievement_field, a.achievement_value, e.slug, ua.created_at
		FROM user_achievements ua
		JOIN achievements a ON a.id = ua.achievement_id
		JOIN users u ON u.id = ua.user_id
		LEFT JOIN event_achievements ea ON ea.achievement_id = a.id
		LEFT JOIN events e ON e.id = ea.event_id
		WHERE ua.created_at >= `+activityWindow+` AND (ua.user_id = ? OR EXISTS (
			SELECT 1 FROM friendships f WHERE f.state = 'accepted'
				AND ((f.user1 = ? AND f.user2 = ua.user_id) OR (f.user2 = ? AND f.user1 = ua.user_id))))
		ORDER BY ua.created_at DESC`,
		[]any{userID, userID, userID},
		append(activityUserDest(&by), &achievement.ID, &achievement.Name, &achievement.Description, &achievement.ImageURL,
			&achievement.AchievementField, &achievement.AchievementValue, &eventSlug, &unlockedAt),
		func() {
			unlocked := achievement
			at := unlockedAt
			unlocked.AchievedAt = &at
			if eventSlug.Valid {
				slug := eventSlug.String
				unlocked.EventSlug = &slug
			}
			if by.ID == userID {
				activities = append(activities, models.Activity{
					ID:          "achievement-" + by.ID + "-" + achievement.ID,
					User:        by,
					Action:      models.ActivityActionAchievement,
					Date:        unlockedAt,
					Achievement: &unlocked,
				})
				return
			}
			// Rows come newest first, so a friend's day takes its date and first
			// achievement from its newest unlock
			key := "achievements-" + by.ID + "-" + utils.GetFormattedDate(unlockedAt.Local())
			if i, ok := friendDays[key]; ok {
				a := &activities[i]
				a.Count++
				if len(a.Achievements) < friendAchievementPreview {
					a.Achievements = append(a.Achievements, unlocked)
				}
				return
			}
			friendDays[key] = len(activities)
			activities = append(activities, models.Activity{
				ID:           key,
				User:         by,
				Action:       models.ActivityActionAchievement,
				Date:         unlockedAt,
				Count:        1,
				Achievement:  &unlocked,
				Achievements: []models.Achievement{unlocked},
			})
		})
	return activities, err
}
