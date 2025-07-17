package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"sort"
	"time"
)

func GetActivityFeed(repo *sql.DB, ctx context.Context, userID string, lastReadID string, cfg *config.Config) ([]models.Activity, error) {
	friendQuery := `
		SELECT DISTINCT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS friend_id
		FROM friendships
		WHERE user_id = ? OR friend_id = ?`
	friendRows, err := repo.QueryContext(ctx, friendQuery, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	defer friendRows.Close()
	friendIDs := map[string]bool{}
	for friendRows.Next() {
		var fid string
		if err := friendRows.Scan(&fid); err == nil {
			friendIDs[fid] = true
		}
	}
	friendIDs[userID] = true // include self for submission ownership

	subQuery := `SELECT id, prompt, user_id FROM user_submissions us JOIN daily_prompts dp ON us.day = dp.day WHERE us.user_id IN (` + placeholders(len(friendIDs)) + `)`
	subArgs := make([]interface{}, 0, len(friendIDs))
	for id := range friendIDs {
		subArgs = append(subArgs, id)
	}
	subRows, err := repo.QueryContext(ctx, subQuery, subArgs...)
	if err != nil {
		return nil, err
	}
	defer subRows.Close()
	subMap := map[string]struct {
		Prompt string
		UserID string
	}{}
	for subRows.Next() {
		var id, prompt, subUserID string
		if err := subRows.Scan(&id, &prompt, &subUserID); err == nil {
			subMap[id] = struct {
				Prompt string
				UserID string
			}{Prompt: prompt, UserID: subUserID}
		}
	}
	if len(subMap) == 0 {
		return []models.Activity{}, nil
	}

	commentQuery := `
		SELECT c.id, c.user_id, u.username, u.email, u.created_at, c.text, c.created_at, c.submission_id
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.submission_id IN (` + placeholders(len(subMap)) + `)
		AND c.created_at >= datetime('now', '-7 days')
		ORDER BY c.created_at DESC
	`
	commentArgs := make([]interface{}, 0, len(subMap))
	for id := range subMap {
		commentArgs = append(commentArgs, id)
	}
	commentRows, err := repo.QueryContext(ctx, commentQuery, commentArgs...)
	if err != nil {
		return nil, err
	}
	defer commentRows.Close()

	activities := []models.Activity{}
	for commentRows.Next() {
		var cID, cUserID, cUsername, cEmail, cText, cSubmissionID string
		var cUserCreatedAt, cCreatedAt time.Time
		if err := commentRows.Scan(&cID, &cUserID, &cUsername, &cEmail, &cUserCreatedAt, &cText, &cCreatedAt, &cSubmissionID); err == nil {
			if cUserID == userID {
				continue
			} // skip own actions
			if !friendIDs[cUserID] {
				continue
			} // only friends' actions
			info := subMap[cSubmissionID]
			activities = append(activities, models.Activity{
				ID:     "comment-" + cID,
				User:   models.User{ID: cUserID, Username: cUsername, Email: cEmail, CreatedAt: cUserCreatedAt},
				Action: models.ActivityActionComment,
				Date:   cCreatedAt,
				Comment: &models.Comment{
					ID:        cID,
					User:      models.User{ID: cUserID, Username: cUsername, Email: cEmail, CreatedAt: cUserCreatedAt},
					Text:      cText,
					CreatedAt: cCreatedAt,
				},
				Submission: &struct {
					ID       string `json:"id"`
					Prompt   string `json:"prompt"`
					ImageUrl string `json:"imageUrl"`
				}{
					ID:       cSubmissionID,
					Prompt:   info.Prompt,
					ImageUrl: utils.GetImageUrl(cfg, utils.GetImageFilename(info.UserID, cSubmissionID)),
				},
			})
		}
	}

	reactionQuery := `
		SELECT r.id, r.user_id, u.username, u.email, u.created_at, r.reaction_id, r.created_at, r.content_id
		FROM reactions r
		JOIN users u ON r.user_id = u.id
		WHERE r.content_type = 'submission' AND r.content_id IN (` + placeholders(len(subMap)) + `)
		AND r.created_at >= datetime('now', '-7 days')
		ORDER BY r.created_at DESC
	`
	reactionRows, err := repo.QueryContext(ctx, reactionQuery, commentArgs...)
	if err != nil {
		return nil, err
	}
	defer reactionRows.Close()
	for reactionRows.Next() {
		var rID, rUserID, rUsername, rEmail, rReactionID, rContentID string
		var rUserCreatedAt, rCreatedAt time.Time
		if err := reactionRows.Scan(&rID, &rUserID, &rUsername, &rEmail, &rUserCreatedAt, &rReactionID, &rCreatedAt, &rContentID); err == nil {
			if rUserID == userID {
				continue
			} // skip own actions
			if !friendIDs[rUserID] {
				continue
			} // only friends' actions
			info := subMap[rContentID]
			activities = append(activities, models.Activity{
				ID:     "reaction-" + rID,
				User:   models.User{ID: rUserID, Username: rUsername, Email: rEmail, CreatedAt: rUserCreatedAt},
				Action: models.ActivityActionReaction,
				Date:   rCreatedAt,
				Reaction: &models.Reaction{
					ID:         rID,
					User:       models.User{ID: rUserID, Username: rUsername, Email: rEmail, CreatedAt: rUserCreatedAt},
					ReactionID: rReactionID,
					CreatedAt:  rCreatedAt,
				},
				Submission: &struct {
					ID       string `json:"id"`
					Prompt   string `json:"prompt"`
					ImageUrl string `json:"imageUrl"`
				}{
					ID:       rContentID,
					Prompt:   info.Prompt,
					ImageUrl: utils.GetImageUrl(cfg, utils.GetImageFilename(info.UserID, rContentID)),
				},
			})
		}
	}

	if len(activities) > 1 {
		sort.Slice(activities, func(i, j int) bool {
			return activities[i].Date.After(activities[j].Date)
		})
	}

	for i := range activities {
		if lastReadID != "" && activities[i].ID <= lastReadID {
			activities[i].IsRead = true
		}
	}

	return activities, nil
}

func GetLastReadActivityID(repo *sql.DB, ctx context.Context, userID string) (string, error) {
	query := `SELECT last_read_activity_id FROM activity_reads WHERE user_id = ?`
	var id sql.NullString
	err := repo.QueryRowContext(ctx, query, userID).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if id.Valid {
		return id.String, nil
	}
	return "", nil
}

func SetLastReadActivityID(repo *sql.DB, ctx context.Context, userID, activityID string) error {
	query := `INSERT INTO activity_reads (user_id, last_read_activity_id, last_read_date) VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET last_read_activity_id = excluded.last_read_activity_id, last_read_date = excluded.last_read_date`
	_, err := repo.ExecContext(ctx, query, userID, activityID)
	return err
}
