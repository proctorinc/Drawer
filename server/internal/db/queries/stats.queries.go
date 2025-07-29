package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"log"
	"time"

	"github.com/google/uuid"
)

type DailyActionStat struct {
	Date      string `json:"date"`
	Drawings  int    `json:"drawings"`
	Reactions int    `json:"reactions"`
	Comments  int    `json:"comments"`
}

// GetDailyActionStats returns, for each day in the range [start, end], the count of drawings, reactions, and comments.
// Days with zero actions are included.
func GetDailyActionStats(db *sql.DB, ctx context.Context, start, end string) ([]DailyActionStat, error) {
	// Generate all days in the range
	layout := "2006-01-02"
	startDate, err := time.Parse(layout, start)
	if err != nil {
		return nil, err
	}
	endDate, err := time.Parse(layout, end)
	if err != nil {
		return nil, err
	}
	days := []string{}
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		days = append(days, d.Format(layout))
	}

	// Query for all actions in the range
	drawings := make(map[string]int)
	reactions := make(map[string]int)
	comments := make(map[string]int)

	// Drawings
	drawingRows, err := db.QueryContext(ctx, `SELECT day, COUNT(*) FROM user_submissions WHERE day >= ? AND day <= ? GROUP BY day`, start, end)
	if err != nil {
		return nil, err
	}
	defer drawingRows.Close()
	for drawingRows.Next() {
		var day string
		var count int
		if err := drawingRows.Scan(&day, &count); err == nil {
			drawings[day] = count
		}
	}

	// Reactions (on submissions and comments)
	reactionRows, err := db.QueryContext(ctx, `SELECT date(created_at) as day, COUNT(*) FROM reactions WHERE day >= ? AND day <= ? GROUP BY day`, start, end)
	if err != nil {
		return nil, err
	}
	defer reactionRows.Close()
	for reactionRows.Next() {
		var day string
		var count int
		if err := reactionRows.Scan(&day, &count); err == nil {
			reactions[day] = count
		}
	}

	// Comments
	commentRows, err := db.QueryContext(ctx, `SELECT date(created_at) as day, COUNT(*) FROM comments WHERE day >= ? AND day <= ? GROUP BY day`, start, end)
	if err != nil {
		return nil, err
	}
	defer commentRows.Close()
	for commentRows.Next() {
		var day string
		var count int
		if err := commentRows.Scan(&day, &count); err == nil {
			comments[day] = count
		}
	}

	// Build result
	result := make([]DailyActionStat, 0, len(days))
	for _, day := range days {
		result = append(result, DailyActionStat{
			Date:      day,
			Drawings:  drawings[day],
			Reactions: reactions[day],
			Comments:  comments[day],
		})
	}

	return result, nil
}

func CalculateCommentCount(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM comments
		WHERE user_id = ?
	`

	var count int
	err := repo.QueryRowContext(ctx, query, userId).Scan(&count)

	if err != nil {
		return 0, err
	}

	return count, nil
}

func CalculateReactionCount(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM user_submissions
		WHERE user_id = ?
	`

	var count int
	err := repo.QueryRowContext(ctx, query, userId).Scan(&count)

	if err != nil {
		return 0, err
	}

	return count, nil
}

func CalculateReactionCommentCount(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM user_submissions
		WHERE user_id = ? AND reaction_type = 'comment'
	`

	var count int
	err := repo.QueryRowContext(ctx, query, userId).Scan(&count)

	if err != nil {
		return 0, err
	}

	return count, nil
}

func CalculateReactionSubmissionCount(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM user_submissions
		WHERE user_id = ? AND reaction_type = 'submission'
	`

	var count int
	err := repo.QueryRowContext(ctx, query, userId).Scan(&count)

	if err != nil {
		return 0, err
	}

	return count, nil
}

func CalculateFriendCount(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM friendships
		WHERE user1 = ? OR user2 = ?
		AND status = 'accepted'
	`

	var count int
	err := repo.QueryRowContext(ctx, query, userId).Scan(&count)

	if err != nil {
		return 0, err
	}

	return count, nil
}

func CalculateSubmissionCount(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM user_submissions
		WHERE user_id = ?
	`

	var count int
	err := repo.QueryRowContext(ctx, query, userId).Scan(&count)

	if err != nil {
		return 0, err
	}

	return count, nil
}

func GetIncompleteAchievements(repo *sql.DB, ctx context.Context, userId string) ([]models.Achievement, error) {
	query := `
		SELECT a.id, a.name, a.description, a.image_url, a.achievement_field, a.achievement_value, ua.created_at, r.id, r.name, r.description, r.created_at
		FROM achievements a
		LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
		LEFT JOIN reward_unlocks r ON r.achievement_id = a.id
		WHERE ua.created_at IS NULL;
	`

	rows, err := repo.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	achievements := []models.Achievement{}
	for rows.Next() {
		var achievement models.Achievement
		var rewardID, rewardName, rewardDescription sql.NullString
		var achievedAt, rewardCreatedAt sql.NullTime
		if err := rows.Scan(&achievement.ID, &achievement.Name, &achievement.Description, &achievement.ImageURL, &achievement.AchievementField, &achievement.AchievementValue, &achievedAt, &rewardID, &rewardName, &rewardDescription, &rewardCreatedAt); err != nil {
			return nil, err
		}

		if rewardID.Valid && rewardName.Valid && rewardDescription.Valid && rewardCreatedAt.Valid {
			reward := models.RewardUnlock{
				ID:          rewardID.String,
				Name:        rewardName.String,
				Description: rewardDescription.String,
				CreatedAt:   rewardCreatedAt.Time,
			}
			achievement.Reward = &reward
		}

		achievements = append(achievements, achievement)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return achievements, nil
}

func GetIncompleteAchievementsByAchievementField(repo *sql.DB, ctx context.Context, userId string, achievementField []string) ([]models.Achievement, error) {
	query := `
		SELECT a.id, a.name, a.description, a.image_url, a.achievement_field, a.achievement_value, ua.created_at, r.id, r.name, r.description, r.created_at
		FROM achievements a
		LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
		LEFT JOIN reward_unlocks r ON r.achievement_id = a.id
		WHERE ua.created_at IS NULL AND a.achievement_field IN (?);
	`

	rows, err := repo.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	achievements := []models.Achievement{}
	for rows.Next() {
		var achievement models.Achievement
		var rewardID, rewardName, rewardDescription sql.NullString
		var achievedAt, rewardCreatedAt sql.NullTime
		if err := rows.Scan(&achievement.ID, &achievement.Name, &achievement.Description, &achievement.ImageURL, &achievement.AchievementField, &achievement.AchievementValue, &achievedAt, &rewardID, &rewardName, &rewardDescription, &rewardCreatedAt); err != nil {
			return nil, err
		}

		if rewardID.Valid && rewardName.Valid && rewardDescription.Valid && rewardCreatedAt.Valid {
			reward := models.RewardUnlock{
				ID:          rewardID.String,
				Name:        rewardName.String,
				Description: rewardDescription.String,
				CreatedAt:   rewardCreatedAt.Time,
			}
			achievement.Reward = &reward
		}

		achievements = append(achievements, achievement)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return achievements, nil
}

func GetLastUserAchievementCheck(repo *sql.DB, ctx context.Context, userID string) (*time.Time, error) {
	query := `
		SELECT checked_at FROM user_achievement_checks WHERE user_id = ?
	`

	var checkedAt sql.NullTime
	err := repo.QueryRowContext(ctx, query, userID).Scan(&checkedAt)

	if err != nil {
		return nil, err
	}

	if checkedAt.Valid {
		return &checkedAt.Time, nil
	}

	return nil, nil
}

func InsertLastUserAchievementCheck(repo *sql.DB, ctx context.Context, userID string) error {
	query := `
		INSERT INTO user_achievement_checks (user_id)
		VALUES (?)
	`

	_, err := repo.ExecContext(ctx, query, userID)

	return err
}

func InsertUserAchievementAndReward(repo *sql.DB, ctx context.Context, userID string, achievement models.Achievement, reward models.RewardUnlock) error {
	query := `
		INSERT INTO achievements (id, image_url, name, description, achievement_field, achievement_value)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err := repo.ExecContext(ctx, query, uuid.New().String(), achievement.ImageURL, achievement.Name, achievement.Description, achievement.AchievementField, achievement.AchievementValue)
	return err
}

func InsertUserAchievement(repo *sql.DB, ctx context.Context, userID, achievementID string) error {
	query := `
		INSERT INTO user_achievements (user_id, achievement_id)
		VALUES (?, ?)
	`

	_, err := repo.ExecContext(ctx, query, userID, achievementID)
	return err
}

func CalculateSubmissionActiveStreak(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	var currentStreak int
	rows, err := repo.QueryContext(ctx, `
		SELECT day FROM user_submissions
		WHERE user_id = ?
		ORDER BY day DESC
	`, userID)
	if err != nil {
		log.Printf("Error fetching submission days for streak: %v", err)
		currentStreak = 0
	} else {
		defer rows.Close()
		var days []string
		for rows.Next() {
			var day string
			if err := rows.Scan(&day); err == nil {
				days = append(days, day)
			}
		}
		streak := 0
		if len(days) > 0 {
			today := time.Now().UTC().Truncate(24 * time.Hour)
			firstDay, _ := time.Parse("2006-01-02", days[0])
			var streakStart time.Time
			if firstDay.Equal(today) {
				streakStart = today
			} else {
				streakStart = today.AddDate(0, 0, -1)
			}
			for _, dayStr := range days {
				d, err := time.Parse("2006-01-02", dayStr)
				if err != nil {
					log.Printf("Streak: skipping unparsable day string: %s", dayStr)
					continue
				}
				d = d.Truncate(24 * time.Hour)
				if d.Equal(streakStart) {
					log.Printf("Streak: day %s matches streakStart %s, streak continues", d.Format("2006-01-02"), streakStart.Format("2006-01-02"))
					streak++
					streakStart = streakStart.AddDate(0, 0, -1)
				} else if d.Before(streakStart) {
					log.Printf("Streak: day %s is before streakStart %s, streak breaks here", d.Format("2006-01-02"), streakStart.Format("2006-01-02"))
					break
				} else if d.After(streakStart) {
					log.Printf("Streak: day %s is after streakStart %s (should not happen if days are sorted desc)", d.Format("2006-01-02"), streakStart.Format("2006-01-02"))
				}
			}
		}
		currentStreak = streak
	}

	return currentStreak, nil
}

// CalculateMaxStreak calculates the maximum consecutive submission streak for a user.
func CalculateSubmissionMaxStreak(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	var maxStreak int
	// Query for all submission days for the given user, ordered ascending for easier processing.
	// This assumes your 'user_submissions' table has a 'day' column of type DATE or similar,
	// and 'user_id' for filtering.
	rows, err := repo.QueryContext(ctx, `
		SELECT day FROM user_submissions
		WHERE user_id = ?
		ORDER BY day ASC
	`, userID)
	if err != nil {
		log.Printf("Error fetching submission days for max streak: %v", err)
		return 0, err
	}
	defer rows.Close() // Ensure rows are closed to release database resources

	var days []time.Time
	// Iterate through the database rows and scan each day into the 'days' slice.
	for rows.Next() {
		var dayStr string
		if err := rows.Scan(&dayStr); err != nil {
			log.Printf("Max Streak: Error scanning day string: %v", err)
			continue // Skip this row if there's a scanning error
		}
		d, parseErr := time.Parse("2006-01-02", dayStr)
		if parseErr != nil {
			log.Printf("Max Streak: skipping unparsable day string: %s, error: %v", dayStr, parseErr)
			continue // Skip if the date string cannot be parsed
		}
		days = append(days, d.Truncate(24*time.Hour)) // Truncate to ensure only date part is considered
	}

	// Check for any errors that occurred during rows.Next() or rows.Scan() after the loop.
	if err = rows.Err(); err != nil {
		log.Printf("Max Streak: Error after iterating rows: %v", err)
		return 0, err
	}

	if len(days) == 0 {
		return 0, nil // No submissions found for the user, so max streak is 0
	}

	currentStreak := 0
	var lastDay time.Time // To keep track of the previous day in the sequence

	// Iterate through the sorted list of submission days to find the longest streak.
	for i, day := range days {
		if i == 0 {
			// Initialize the first streak with 1 day.
			currentStreak = 1
		} else {
			// Calculate the expected previous day for a continuous streak.
			expectedPrevDay := day.AddDate(0, 0, -1)

			// Check if the current day is exactly one day after the last day.
			if lastDay.Equal(expectedPrevDay) {
				currentStreak++
			} else if day.After(expectedPrevDay) {
				// If there's a gap (current day is more than one day after lastDay),
				// the current streak is broken.
				// Update maxStreak if the current one is larger than the previously recorded max.
				if currentStreak > maxStreak {
					maxStreak = currentStreak
				}
				// Start a new streak from the current day.
				currentStreak = 1
			}
			// If day.Equal(lastDay), it means a duplicate entry for the same day.
			// In this case, the streak continues, and no action is needed here.
			// This scenario is less likely if your database query ensures distinct days.
		}
		lastDay = day // Update lastDay for the next iteration.

		// After processing the last day in the loop, ensure the final streak is considered
		// as it might be the maximum streak.
		if i == len(days)-1 {
			if currentStreak > maxStreak {
				maxStreak = currentStreak
			}
		}
	}

	return maxStreak, nil
}

func HasRewardUnlocked(repo *sql.DB, ctx context.Context, userId string, rewardId string) (bool, error) {
	query := `
	SELECT EXISTS(
	  SELECT ua.created_at
				FROM achievements a
				JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
				JOIN reward_unlocks r ON r.achievement_id = a.id
	    WHERE r.id = ?
	);`

	var exists bool
	err := repo.QueryRowContext(ctx, query, userId, rewardId).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func InsertCalculatedStat(repo *sql.DB, ctx context.Context, userId string, statType string, statValue int) error {
	query := `
	INSERT OR IGNORE INTO user_stat_calculations (id, user_id, stat_type, stat_value, last_updated_at)
	VALUES ($1, $2, $3, $4, $5)
	UPDATE user_stat_calculations SET user_id = $2, stat_type = $3, stat_value = $4, last_updated_at = $5
	`

	_, err := repo.ExecContext(ctx, query, uuid.New().String(), userId, statType, statValue, time.Now())
	return err
}

func GetCalculatedStat(repo *sql.DB, ctx context.Context, userId string, statType string) (int, error) {
	query := `
	SELECT stat_value
	FROM user_stat_calculations
	WHERE user_id = $1 AND stat_type = $2
	`

	var statValue int
	err := repo.QueryRowContext(ctx, query, userId, statType).Scan(&statValue)
	if err != nil {
		return 0, err
	}
	return statValue, nil
}

func GetCalculatedStats(repo *sql.DB, ctx context.Context, userId string, statTypes []string) (map[string]int, error) {
	query := `
	SELECT stat_type, stat_value
	FROM user_stat_calculations
	WHERE user_id = $1 AND stat_type IN ($2)
	`

	rows, err := repo.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[string]int)
	for rows.Next() {
		var statType string
		var statValue int
		if err := rows.Scan(&statType, &statValue); err != nil {
			return nil, err
		}
		stats[statType] = statValue
	}

	return stats, nil
}
