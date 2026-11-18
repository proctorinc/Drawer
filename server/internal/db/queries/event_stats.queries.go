package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"fmt"
)

// Event stats take an inclusive range of YYYY-MM-DD days (see events.Days), matching
// user_submissions.day.

// GetUserSubmissionDays returns the distinct days in [firstDay, lastDay] the user submitted, ascending.
func GetUserSubmissionDays(repo *sql.DB, ctx context.Context, userID, firstDay, lastDay string) ([]string, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT DISTINCT day FROM user_submissions
		WHERE user_id = ? AND day BETWEEN ? AND ?
		ORDER BY day ASC`, userID, firstDay, lastDay)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	days := []string{}
	for rows.Next() {
		var day string
		if err := rows.Scan(&day); err != nil {
			return nil, err
		}
		days = append(days, day)
	}
	return days, rows.Err()
}

// reactionsReceivedSQL counts other users' reactions on u.id's submissions from days [?, ?].
const reactionsReceivedSQL = `(
	SELECT COUNT(*) FROM reactions r
	JOIN user_submissions rs ON r.content_type = 'submission' AND r.content_id = rs.id
	WHERE rs.user_id = u.id AND r.user_id != u.id AND rs.day BETWEEN ? AND ?
)`

// CountReactionsReceived counts other users' reactions on the user's submissions from [firstDay, lastDay].
func CountReactionsReceived(repo *sql.DB, ctx context.Context, userID, firstDay, lastDay string) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `SELECT `+reactionsReceivedSQL+` FROM users u WHERE u.id = ?`,
		firstDay, lastDay, userID).Scan(&count)
	return count, err
}

type EventLeaderboardEntry struct {
	User              models.User `json:"user"`
	Doodles           int         `json:"doodles"`
	ReactionsReceived int         `json:"reactionsReceived"`
}

// GetEventLeaderboard ranks the user and their accepted friends by doodles in [firstDay, lastDay],
// then by reactions received on those doodles.
func GetEventLeaderboard(repo *sql.DB, ctx context.Context, userID, firstDay, lastDay string) ([]EventLeaderboardEntry, error) {
	query := `
		SELECT u.id, u.username, u.email, u.created_at, u.avatar_type, u.avatar_url, u.decoration,
			(SELECT COUNT(*) FROM user_submissions us WHERE us.user_id = u.id AND us.day BETWEEN ? AND ?) AS doodles,
			` + reactionsReceivedSQL + ` AS reactions_received
		FROM users u
		WHERE u.id = ? OR u.id IN (
			SELECT user2 FROM friendships WHERE user1 = ? AND state = 'accepted'
			UNION
			SELECT user1 FROM friendships WHERE user2 = ? AND state = 'accepted'
		)
		ORDER BY doodles DESC, reactions_received DESC, u.username ASC`

	rows, err := repo.QueryContext(ctx, query, firstDay, lastDay, firstDay, lastDay, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []EventLeaderboardEntry{}
	for rows.Next() {
		var entry EventLeaderboardEntry
		user := &entry.User
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt, &user.AvatarType, &user.AvatarURL, &user.Decoration,
			&entry.Doodles, &entry.ReactionsReceived); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

// GetUserSubmissionsInDays returns the user's submissions from [firstDay, lastDay], ascending by day,
// with comments, reactions and counts like GET /submission/:id.
func GetUserSubmissionsInDays(repo *sql.DB, ctx context.Context, cfg *config.Config, userID, firstDay, lastDay string) ([]models.UserPromptSubmission, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT us.id, us.day, dp.colors, dp.prompt, us.created_at,
			u.id, u.username, u.email, u.created_at, u.avatar_type, u.avatar_url, u.decoration,
			dpu.id, dpu.username, dpu.email, dpu.created_at, dpu.avatar_type, dpu.avatar_url, dpu.decoration,
			EXISTS(SELECT 1 FROM user_favorite_submissions f WHERE f.user_id = u.id AND f.submission_id = us.id)
		FROM user_submissions us
		JOIN daily_prompts dp ON us.day = dp.day
		JOIN users u ON us.user_id = u.id
		LEFT JOIN users dpu ON dp.created_by = dpu.id
		WHERE us.user_id = ? AND us.day BETWEEN ? AND ?
		ORDER BY us.day ASC`, userID, firstDay, lastDay)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	submissions := []models.UserPromptSubmission{}
	for rows.Next() {
		var (
			sub                                                                                          models.UserPromptSubmission
			colorsJSON                                                                                   string
			creatorID, creatorName, creatorEmail, creatorAvatarType, creatorAvatarURL, creatorDecoration sql.NullString
			creatorCreatedAt                                                                             sql.NullTime
		)
		if err := rows.Scan(&sub.ID, &sub.Day, &colorsJSON, &sub.Prompt, &sub.CreatedAt,
			&sub.User.ID, &sub.User.Username, &sub.User.Email, &sub.User.CreatedAt, &sub.User.AvatarType, &sub.User.AvatarURL, &sub.User.Decoration,
			&creatorID, &creatorName, &creatorEmail, &creatorCreatedAt, &creatorAvatarType, &creatorAvatarURL, &creatorDecoration,
			&sub.IsFavorite); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(colorsJSON), &sub.Colors); err != nil {
			return nil, fmt.Errorf("error parsing colors for %s: %w", sub.Day, err)
		}
		if creatorID.Valid {
			sub.CreatedBy = &models.User{
				ID:         creatorID.String,
				Username:   creatorName.String,
				Email:      creatorEmail.String,
				CreatedAt:  creatorCreatedAt.Time,
				AvatarType: creatorAvatarType.String,
				AvatarURL:  creatorAvatarURL.String,
				Decoration: creatorDecoration.String,
			}
		}
		sub.ImageUrl = utils.GetImageUrl(cfg, utils.GetSubmissionFilename(sub.User.ID, sub.ID))
		submissions = append(submissions, sub)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	for i := range submissions {
		if err := addSubmissionDetails(repo, ctx, &submissions[i]); err != nil {
			return nil, err
		}
	}
	return submissions, nil
}

func addSubmissionDetails(repo *sql.DB, ctx context.Context, sub *models.UserPromptSubmission) error {
	var err error
	if sub.Reactions, err = GetSubmissionReactions(repo, ctx, sub.ID); err != nil {
		return err
	}
	if sub.Counts, err = GetSubmissionReactionCounts(repo, ctx, sub.ID); err != nil {
		return err
	}

	rows, err := repo.QueryContext(ctx, `
		SELECT c.id, c.text, c.created_at, u.id, u.username, u.email, u.created_at, u.avatar_type, u.avatar_url, u.decoration
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.submission_id = ?
		ORDER BY c.created_at ASC`, sub.ID)
	if err != nil {
		return err
	}
	defer rows.Close()

	sub.Comments = []models.Comment{}
	for rows.Next() {
		var comment models.Comment
		if err := rows.Scan(&comment.ID, &comment.Text, &comment.CreatedAt, &comment.User.ID, &comment.User.Username,
			&comment.User.Email, &comment.User.CreatedAt, &comment.User.AvatarType, &comment.User.AvatarURL, &comment.User.Decoration); err != nil {
			return err
		}
		sub.Comments = append(sub.Comments, comment)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()

	for i := range sub.Comments {
		comment := &sub.Comments[i]
		if comment.Reactions, err = GetCommentReactions(repo, ctx, comment.ID); err != nil {
			return err
		}
		if comment.Counts, err = GetCommentReactionCounts(repo, ctx, comment.ID); err != nil {
			return err
		}
	}
	return nil
}

// GetAchievementEvent returns the event an achievement belongs to, or sql.ErrNoRows.
func GetAchievementEvent(repo *sql.DB, ctx context.Context, achievementID string) (models.Event, error) {
	return getEvent(repo, ctx,
		`WHERE id = (SELECT event_id FROM event_achievements WHERE achievement_id = ?)`, achievementID)
}

// ClaimEventNotification records that an event broadcast is being sent. It returns false if it
// was already claimed, so each broadcast goes out at most once, even across restarts.
func ClaimEventNotification(repo *sql.DB, ctx context.Context, eventID, kind string) (bool, error) {
	result, err := repo.ExecContext(ctx,
		`INSERT OR IGNORE INTO event_notifications_sent (event_id, kind) VALUES (?, ?)`, eventID, kind)
	if err != nil {
		return false, err
	}
	inserted, err := result.RowsAffected()
	return inserted == 1, err
}

// GetPushSubscribedUserIDs returns every user with at least one push subscription.
func GetPushSubscribedUserIDs(repo *sql.DB, ctx context.Context) ([]string, error) {
	rows, err := repo.QueryContext(ctx, `SELECT DISTINCT user_id FROM push_subscriptions`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userIDs := []string{}
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		userIDs = append(userIDs, userID)
	}
	return userIDs, rows.Err()
}
