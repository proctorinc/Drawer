package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
)

func GetUserByID(repo *sql.DB, ctx context.Context, userID string) (*models.User, error) {
	var user models.User
	query := `SELECT id, username, email, role, created_at FROM users WHERE id = ?`
	err := repo.QueryRowContext(ctx, query, userID).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func GetUserByEmail(repo *sql.DB, ctx context.Context, email string) (*models.User, error) {
	var user models.User
	query := `SELECT id, username, email, role, created_at FROM users WHERE email = ?`
	err := repo.QueryRowContext(ctx, query, email).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func GetUserFromDB(repo *sql.DB, ctx context.Context, userID string) (models.User, error) {
	query := `SELECT id, username, email, role, created_at FROM users WHERE id = ?`

	row := repo.QueryRowContext(ctx, query, userID)

	var user models.User
	err := row.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, err
		}
		// Log the error for debugging
		log.Printf("Error fetching user %s: %v", userID, err)
		return models.User{}, fmt.Errorf("failed to fetch user: %w", err)
	}

	return user, nil
}

func GetUserDataFromDB(repo *sql.DB, ctx context.Context, userID string, cfg *config.Config) (models.GetMeResponse, error) {
	var response models.GetMeResponse

	userQuery := `SELECT id, username, email, role, created_at FROM users WHERE id = ?`
	var user models.User
	err := repo.QueryRowContext(ctx, userQuery, userID).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		log.Printf("Error fetching user info for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}
	response.User = user

	friendsQuery := `
		SELECT DISTINCT
			u.id,
			u.username,
			u.email,
			u.created_at
		FROM
			friendships f
		JOIN
			users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
		ORDER BY u.username`
	friendsRows, err := repo.QueryContext(ctx, friendsQuery, userID, userID)
	if err != nil {
		log.Printf("Error fetching friends for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}
	defer friendsRows.Close()
	response.Friends = []models.User{}
	friendIDs := []string{}
	for friendsRows.Next() {
		var friend models.User
		err := friendsRows.Scan(&friend.ID, &friend.Username, &friend.Email, &friend.CreatedAt)
		if err != nil {
			log.Printf("Error scanning friend row: %v", err)
			continue
		}
		response.Friends = append(response.Friends, friend)
		friendIDs = append(friendIDs, friend.ID)
	}
	if err = friendsRows.Err(); err != nil {
		log.Printf("Error iterating friends rows: %v", err)
		return models.GetMeResponse{}, err
	}

	submissionIDs := []interface{}{userID}
	whereClause := "us.user_id = ?"
	if len(friendIDs) > 0 {
		whereClause = "(us.user_id = ? OR us.user_id IN (" + strings.Repeat("?,", len(friendIDs)-1) + "?) )"
		for _, id := range friendIDs {
			submissionIDs = append(submissionIDs, id)
		}
	}

	// Get submissions and comments
	submissionQuery := `
		SELECT
			us.id as submission_id,
			us.day,
			dp.colors,
			dp.prompt,
			u.id as user_id,
			u.username,
			u.email,
			u.created_at,
			us.created_at as submission_created_at,
			c.id as comment_id,
			c.text as comment_text,
			cu.id as comment_user_id,
			cu.username as comment_username,
			cu.email as comment_user_email,
			cu.created_at as comment_user_created_at,
			c.created_at as comment_created_at
		FROM user_submissions us
		JOIN daily_prompts dp ON us.day = dp.day
		JOIN users u ON us.user_id = u.id
		LEFT JOIN comments c ON c.submission_id = us.id
		LEFT JOIN users cu ON c.user_id = cu.id
		WHERE ` + whereClause + `
		ORDER BY us.day DESC, submission_created_at DESC, c.created_at DESC`

	rows, err := repo.QueryContext(ctx, submissionQuery, submissionIDs...)
	if err != nil {
		log.Printf("Error fetching submissions and comments: %v", err)
		return models.GetMeResponse{}, err
	}
	defer rows.Close()

	// Map submission_id to UserPromptSubmission
	subMap := make(map[string]*models.UserPromptSubmission)
	response.Feed = []*models.UserPromptSubmission{}
	response.Prompts = []*models.UserPromptSubmission{}

	for rows.Next() {
		var (
			subID, day, colorsJSON, prompt, subUserID, subUsername, subUserEmail     string
			subUserCreatedAt, subCreatedAt                                           time.Time
			commentID, commentText, commentUserID, commentUsername, commentUserEmail sql.NullString
			commentUserCreatedAt, commentCreatedAt                                   sql.NullTime
		)
		err := rows.Scan(
			&subID,
			&day,
			&colorsJSON,
			&prompt,
			&subUserID,
			&subUsername,
			&subUserEmail,
			&subUserCreatedAt,
			&subCreatedAt,
			&commentID,
			&commentText,
			&commentUserID,
			&commentUsername,
			&commentUserEmail,
			&commentUserCreatedAt,
			&commentCreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning submission+comment row: %v", err)
			continue
		}

		filename := utils.GetImageFilename(subUserID, subID)

		sub, exists := subMap[subID]
		if !exists {
			var colors []string
			_ = json.Unmarshal([]byte(colorsJSON), &colors)
			submission := models.UserPromptSubmission{
				ID:     subID,
				Day:    day,
				Colors: colors,
				Prompt: prompt,
				User: models.User{
					ID:        subUserID,
					Username:  subUsername,
					Email:     subUserEmail,
					CreatedAt: subUserCreatedAt,
				},
				ImageUrl:  utils.GetImageUrl(cfg, filename),
				Comments:  []models.Comment{},
				Reactions: []models.Reaction{},
				Counts:    []models.ReactionCount{},
			}
			subMap[subID] = &submission
			// Add to feed as a flat list
			response.Feed = append(response.Feed, &submission)
			// If this is the main user's submission, add to Prompts
			if subUserID == userID {
				response.Prompts = append(response.Prompts, &submission)
			}
			sub = &submission
		}
		// Add comment if present
		if commentID.Valid && commentText.Valid && commentUserID.Valid && commentUsername.Valid && commentUserEmail.Valid && commentUserCreatedAt.Valid && commentCreatedAt.Valid {
			comment := models.Comment{
				ID: commentID.String,
				User: models.User{
					ID:        commentUserID.String,
					Username:  commentUsername.String,
					Email:     commentUserEmail.String,
					CreatedAt: commentUserCreatedAt.Time,
				},
				Text:      commentText.String,
				CreatedAt: commentCreatedAt.Time,
				Reactions: []models.Reaction{},
				Counts:    []models.ReactionCount{},
			}
			sub.Comments = append(sub.Comments, comment)
		}
	}
	if err = rows.Err(); err != nil {
		log.Printf("Error iterating submission+comment rows: %v", err)
		return models.GetMeResponse{}, err
	}

	if len(subMap) > 0 {
		submissionIDList := make([]string, 0, len(subMap))
		for id := range subMap {
			submissionIDList = append(submissionIDList, id)
		}

		// Get all submission reactions in one query
		submissionReactionsQuery := `
			SELECT
				r.content_id as submission_id,
				r.id,
				r.reaction_id,
				r.created_at,
				u.id,
				u.username,
				u.email,
				u.created_at
			FROM reactions r
			JOIN users u ON r.user_id = u.id
			WHERE r.content_type = 'submission' AND r.content_id IN (` + placeholders(len(submissionIDList)) + `)
			ORDER BY r.created_at ASC
		`
		reactionArgs := make([]interface{}, len(submissionIDList))
		for i, id := range submissionIDList {
			reactionArgs[i] = id
		}

		reactionRows, err := repo.QueryContext(ctx, submissionReactionsQuery, reactionArgs...)
		if err != nil {
			log.Printf("Error fetching submission reactions: %v", err)
		} else {
			defer reactionRows.Close()
			for reactionRows.Next() {
				var submissionID string
				var reaction models.Reaction
				var user models.User
				err := reactionRows.Scan(
					&submissionID,
					&reaction.ID,
					&reaction.ReactionID,
					&reaction.CreatedAt,
					&user.ID,
					&user.Username,
					&user.Email,
					&user.CreatedAt,
				)
				if err != nil {
					log.Printf("Error scanning reaction row: %v", err)
					continue
				}
				reaction.User = user
				if sub, exists := subMap[submissionID]; exists {
					sub.Reactions = append(sub.Reactions, reaction)
				}
			}
		}

		// Get all submission reaction counts in one query
		submissionCountsQuery := `
			SELECT
				content_id as submission_id,
				reaction_id,
				COUNT(*) as count
			FROM reactions
			WHERE content_type = 'submission' AND content_id IN (` + placeholders(len(submissionIDList)) + `)
			GROUP BY content_id, reaction_id
			ORDER BY content_id, count DESC, reaction_id ASC
		`
		countRows, err := repo.QueryContext(ctx, submissionCountsQuery, reactionArgs...)
		if err != nil {
			log.Printf("Error fetching submission reaction counts: %v", err)
		} else {
			defer countRows.Close()
			for countRows.Next() {
				var submissionID, reactionID string
				var count int
				err := countRows.Scan(&submissionID, &reactionID, &count)
				if err != nil {
					log.Printf("Error scanning count row: %v", err)
					continue
				}
				if sub, exists := subMap[submissionID]; exists {
					sub.Counts = append(sub.Counts, models.ReactionCount{ReactionID: reactionID, Count: count})
				}
			}
		}

		// Get all comment reactions and counts in bulk
		commentReactionsQuery := `
			SELECT
				r.content_id as comment_id,
				r.id,
				r.reaction_id,
				r.created_at,
				u.id,
				u.username,
				u.email,
				u.created_at
			FROM reactions r
			JOIN users u ON r.user_id = u.id
			WHERE r.content_type = 'comment' AND r.content_id IN (
				SELECT c.id FROM comments c WHERE c.submission_id IN (` + placeholders(len(submissionIDList)) + `)
			)
			ORDER BY r.created_at ASC
		`
		commentReactionRows, err := repo.QueryContext(ctx, commentReactionsQuery, reactionArgs...)
		if err != nil {
			log.Printf("Error fetching comment reactions: %v", err)
		} else {
			defer commentReactionRows.Close()
			commentReactions := make(map[string][]models.Reaction)
			for commentReactionRows.Next() {
				var commentID string
				var reaction models.Reaction
				var user models.User
				err := commentReactionRows.Scan(
					&commentID,
					&reaction.ID,
					&reaction.ReactionID,
					&reaction.CreatedAt,
					&user.ID,
					&user.Username,
					&user.Email,
					&user.CreatedAt,
				)
				if err != nil {
					log.Printf("Error scanning comment reaction row: %v", err)
					continue
				}
				reaction.User = user
				commentReactions[commentID] = append(commentReactions[commentID], reaction)
			}

			// Assign reactions to comments
			for _, submission := range response.Feed {
				for i := range submission.Comments {
					if reactions, exists := commentReactions[submission.Comments[i].ID]; exists {
						submission.Comments[i].Reactions = reactions
					}
				}
			}
		}

		// Get all comment reaction counts in bulk
		commentCountsQuery := `
			SELECT
				content_id as comment_id,
				reaction_id,
				COUNT(*) as count
			FROM reactions
			WHERE content_type = 'comment' AND content_id IN (
				SELECT c.id FROM comments c WHERE c.submission_id IN (` + placeholders(len(submissionIDList)) + `)
			)
			GROUP BY content_id, reaction_id
			ORDER BY content_id, count DESC, reaction_id ASC
		`
		commentCountRows, err := repo.QueryContext(ctx, commentCountsQuery, reactionArgs...)
		if err != nil {
			log.Printf("Error fetching comment reaction counts: %v", err)
		} else {
			defer commentCountRows.Close()
			commentCounts := make(map[string][]models.ReactionCount)
			for commentCountRows.Next() {
				var commentID, reactionID string
				var count int
				err := commentCountRows.Scan(&commentID, &reactionID, &count)
				if err != nil {
					log.Printf("Error scanning comment count row: %v", err)
					continue
				}
				commentCounts[commentID] = append(commentCounts[commentID], models.ReactionCount{ReactionID: reactionID, Count: count})
			}

			// Assign counts to comments
			for _, submission := range response.Feed {
				for i := range submission.Comments {
					if counts, exists := commentCounts[submission.Comments[i].ID]; exists {
						submission.Comments[i].Counts = counts
					}
				}
			}
		}
	}

	totalDrawingsQuery := `SELECT COUNT(*) FROM user_submissions WHERE user_id = ?`
	var totalDrawings int
	err = repo.QueryRowContext(ctx, totalDrawingsQuery, userID).Scan(&totalDrawings)
	if err != nil {
		log.Printf("Error fetching total drawings for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}

	// Calculate current streak - consecutive days of submissions (Go implementation)
	var currentStreak int
	rows, err = repo.QueryContext(ctx, `
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

	response.Stats = models.UserStats{
		TotalDrawings: totalDrawings,
		CurrentStreak: currentStreak,
	}

	favQuery := `SELECT id, submission_id, created_at, order_num FROM user_favorite_submissions WHERE user_id = ? ORDER BY order_num DESC`
	favRows, err := repo.QueryContext(ctx, favQuery, userID)
	if err != nil {
		log.Printf("Error fetching favorites for user %s: %v", userID, err)
		response.Favorites = []*models.FavoriteSubmission{}
	} else {
		defer favRows.Close()
		response.Favorites = []*models.FavoriteSubmission{}
		favoriteSet := make(map[string]struct{})
		for favRows.Next() {
			var favID, favSubmissionID string
			var favCreatedAt time.Time
			var favOrderNum int
			err := favRows.Scan(&favID, &favSubmissionID, &favCreatedAt, &favOrderNum)
			if err != nil {
				log.Printf("Error scanning favorite row: %v", err)
				continue
			}
			// Find the full UserPromptSubmission in subMap
			sub, exists := subMap[favSubmissionID]
			if !exists {
				continue // skip if not found
			}
			favoriteSet[favSubmissionID] = struct{}{}
			fav := &models.FavoriteSubmission{
				ID:         favID,
				Submission: *sub,
				CreatedAt:  favCreatedAt,
				OrderNum:   favOrderNum,
			}
			response.Favorites = append(response.Favorites, fav)
		}
		// Set IsFavorite only for user's own submissions
		for _, sub := range response.Prompts {
			if _, ok := favoriteSet[sub.ID]; ok {
				sub.IsFavorite = true
			}
		}
	}

	return response, nil
}

func GetUserProfileFromDB(repo *sql.DB, ctx context.Context, userID string, cfg *config.Config) (models.GetMeResponse, error) {
	var response models.GetMeResponse

	userQuery := `SELECT id, username, email, role, created_at FROM users WHERE id = ?`
	var user models.User
	err := repo.QueryRowContext(ctx, userQuery, userID).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		log.Printf("Error fetching user info for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}
	response.User = user

	friendsQuery := `
		SELECT DISTINCT
			u.id,
			u.username,
			u.email,
			u.created_at
		FROM
			friendships f
		JOIN
			users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
		ORDER BY u.username`
	friendsRows, err := repo.QueryContext(ctx, friendsQuery, userID, userID)
	if err != nil {
		log.Printf("Error fetching friends for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}
	defer friendsRows.Close()
	response.Friends = []models.User{}
	friendIDs := []string{}
	for friendsRows.Next() {
		var friend models.User
		err := friendsRows.Scan(&friend.ID, &friend.Username, &friend.Email, &friend.CreatedAt)
		if err != nil {
			log.Printf("Error scanning friend row: %v", err)
			continue
		}
		response.Friends = append(response.Friends, friend)
		friendIDs = append(friendIDs, friend.ID)
	}
	if err = friendsRows.Err(); err != nil {
		log.Printf("Error iterating friends rows: %v", err)
		return models.GetMeResponse{}, err
	}

	submissionIDs := []interface{}{userID}
	whereClause := "us.user_id = ?"
	if len(friendIDs) > 0 {
		whereClause = "(us.user_id = ? OR us.user_id IN (" + strings.Repeat("?,", len(friendIDs)-1) + "?) )"
		for _, id := range friendIDs {
			submissionIDs = append(submissionIDs, id)
		}
	}

	// Get submissions and comments
	submissionQuery := `
		SELECT
			us.id as submission_id,
			us.day,
			dp.colors,
			dp.prompt,
			u.id as user_id,
			u.username,
			u.email,
			u.created_at,
			us.created_at as submission_created_at,
			c.id as comment_id,
			c.text as comment_text,
			cu.id as comment_user_id,
			cu.username as comment_username,
			cu.email as comment_user_email,
			cu.created_at as comment_user_created_at,
			c.created_at as comment_created_at
		FROM user_submissions us
		JOIN daily_prompts dp ON us.day = dp.day
		JOIN users u ON us.user_id = u.id
		LEFT JOIN comments c ON c.submission_id = us.id
		LEFT JOIN users cu ON c.user_id = cu.id
		WHERE ` + whereClause + `
		ORDER BY us.day DESC, submission_created_at DESC, c.created_at DESC`

	rows, err := repo.QueryContext(ctx, submissionQuery, submissionIDs...)
	if err != nil {
		log.Printf("Error fetching submissions and comments: %v", err)
		return models.GetMeResponse{}, err
	}
	defer rows.Close()

	// Map submission_id to UserPromptSubmission
	subMap := make(map[string]*models.UserPromptSubmission)
	response.Feed = []*models.UserPromptSubmission{}
	response.Prompts = []*models.UserPromptSubmission{}

	for rows.Next() {
		var (
			subID, day, colorsJSON, prompt, subUserID, subUsername, subUserEmail     string
			subUserCreatedAt, subCreatedAt                                           time.Time
			commentID, commentText, commentUserID, commentUsername, commentUserEmail sql.NullString
			commentUserCreatedAt, commentCreatedAt                                   sql.NullTime
		)
		err := rows.Scan(
			&subID,
			&day,
			&colorsJSON,
			&prompt,
			&subUserID,
			&subUsername,
			&subUserEmail,
			&subUserCreatedAt,
			&subCreatedAt,
			&commentID,
			&commentText,
			&commentUserID,
			&commentUsername,
			&commentUserEmail,
			&commentUserCreatedAt,
			&commentCreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning submission+comment row: %v", err)
			continue
		}

		sub, exists := subMap[subID]
		if !exists {
			var colors []string
			_ = json.Unmarshal([]byte(colorsJSON), &colors)
			submission := models.UserPromptSubmission{
				ID:     subID,
				Day:    day,
				Colors: colors,
				Prompt: prompt,
				User: models.User{
					ID:        subUserID,
					Username:  subUsername,
					Email:     subUserEmail,
					CreatedAt: subUserCreatedAt,
				},
				ImageUrl:  utils.GetImageUrl(cfg, utils.GetImageFilename(subUserID, subID)),
				Comments:  []models.Comment{},
				Reactions: []models.Reaction{},
				Counts:    []models.ReactionCount{},
			}
			subMap[subID] = &submission
			// Add to feed as a flat list
			response.Feed = append(response.Feed, &submission)
			// If this is the main user's submission, add to Prompts
			if subUserID == userID {
				response.Prompts = append(response.Prompts, &submission)
			}
			sub = &submission
		}
		// Add comment if present
		if commentID.Valid && commentText.Valid && commentUserID.Valid && commentUsername.Valid && commentUserEmail.Valid && commentUserCreatedAt.Valid && commentCreatedAt.Valid {
			comment := models.Comment{
				ID: commentID.String,
				User: models.User{
					ID:        commentUserID.String,
					Username:  commentUsername.String,
					Email:     commentUserEmail.String,
					CreatedAt: commentUserCreatedAt.Time,
				},
				Text:      commentText.String,
				CreatedAt: commentCreatedAt.Time,
				Reactions: []models.Reaction{},
				Counts:    []models.ReactionCount{},
			}
			sub.Comments = append(sub.Comments, comment)
		}
	}
	if err = rows.Err(); err != nil {
		log.Printf("Error iterating submission+comment rows: %v", err)
		return models.GetMeResponse{}, err
	}

	// 4. Get all reactions and counts in bulk queries (eliminates N+1 problem)
	if len(subMap) > 0 {
		submissionIDList := make([]string, 0, len(subMap))
		for id := range subMap {
			submissionIDList = append(submissionIDList, id)
		}

		// Get all submission reactions in one query
		submissionReactionsQuery := `
			SELECT
				r.content_id as submission_id,
				r.id,
				r.reaction_id,
				r.created_at,
				u.id,
				u.username,
				u.email,
				u.created_at
			FROM reactions r
			JOIN users u ON r.user_id = u.id
			WHERE r.content_type = 'submission' AND r.content_id IN (` + placeholders(len(submissionIDList)) + `)
			ORDER BY r.created_at ASC
		`
		reactionArgs := make([]interface{}, len(submissionIDList))
		for i, id := range submissionIDList {
			reactionArgs[i] = id
		}

		reactionRows, err := repo.QueryContext(ctx, submissionReactionsQuery, reactionArgs...)
		if err != nil {
			log.Printf("Error fetching submission reactions: %v", err)
		} else {
			defer reactionRows.Close()
			for reactionRows.Next() {
				var submissionID string
				var reaction models.Reaction
				var user models.User
				err := reactionRows.Scan(
					&submissionID,
					&reaction.ID,
					&reaction.ReactionID,
					&reaction.CreatedAt,
					&user.ID,
					&user.Username,
					&user.Email,
					&user.CreatedAt,
				)
				if err != nil {
					log.Printf("Error scanning reaction row: %v", err)
					continue
				}
				reaction.User = user
				if sub, exists := subMap[submissionID]; exists {
					sub.Reactions = append(sub.Reactions, reaction)
				}
			}
		}

		// Get all submission reaction counts in one query
		submissionCountsQuery := `
			SELECT
				content_id as submission_id,
				reaction_id,
				COUNT(*) as count
			FROM reactions
			WHERE content_type = 'submission' AND content_id IN (` + placeholders(len(submissionIDList)) + `)
			GROUP BY content_id, reaction_id
			ORDER BY content_id, count DESC, reaction_id ASC
		`
		countRows, err := repo.QueryContext(ctx, submissionCountsQuery, reactionArgs...)
		if err != nil {
			log.Printf("Error fetching submission reaction counts: %v", err)
		} else {
			defer countRows.Close()
			for countRows.Next() {
				var submissionID, reactionID string
				var count int
				err := countRows.Scan(&submissionID, &reactionID, &count)
				if err != nil {
					log.Printf("Error scanning count row: %v", err)
					continue
				}
				if sub, exists := subMap[submissionID]; exists {
					sub.Counts = append(sub.Counts, models.ReactionCount{ReactionID: reactionID, Count: count})
				}
			}
		}

		// Get all comment reactions and counts in bulk
		commentReactionsQuery := `
			SELECT
				r.content_id as comment_id,
				r.id,
				r.reaction_id,
				r.created_at,
				u.id,
				u.username,
				u.email,
				u.created_at
			FROM reactions r
			JOIN users u ON r.user_id = u.id
			WHERE r.content_type = 'comment' AND r.content_id IN (
				SELECT c.id FROM comments c WHERE c.submission_id IN (` + placeholders(len(submissionIDList)) + `)
			)
			ORDER BY r.created_at ASC
		`
		commentReactionRows, err := repo.QueryContext(ctx, commentReactionsQuery, reactionArgs...)
		if err != nil {
			log.Printf("Error fetching comment reactions: %v", err)
		} else {
			defer commentReactionRows.Close()
			commentReactions := make(map[string][]models.Reaction)
			for commentReactionRows.Next() {
				var commentID string
				var reaction models.Reaction
				var user models.User
				err := commentReactionRows.Scan(
					&commentID,
					&reaction.ID,
					&reaction.ReactionID,
					&reaction.CreatedAt,
					&user.ID,
					&user.Username,
					&user.Email,
					&user.CreatedAt,
				)
				if err != nil {
					log.Printf("Error scanning comment reaction row: %v", err)
					continue
				}
				reaction.User = user
				commentReactions[commentID] = append(commentReactions[commentID], reaction)
			}

			// Assign reactions to comments
			for _, submission := range response.Feed {
				for i := range submission.Comments {
					if reactions, exists := commentReactions[submission.Comments[i].ID]; exists {
						submission.Comments[i].Reactions = reactions
					}
				}
			}
		}

		// Get all comment reaction counts in bulk
		commentCountsQuery := `
			SELECT
				content_id as comment_id,
				reaction_id,
				COUNT(*) as count
			FROM reactions
			WHERE content_type = 'comment' AND content_id IN (
				SELECT c.id FROM comments c WHERE c.submission_id IN (` + placeholders(len(submissionIDList)) + `)
			)
			GROUP BY content_id, reaction_id
			ORDER BY content_id, count DESC, reaction_id ASC
		`
		commentCountRows, err := repo.QueryContext(ctx, commentCountsQuery, reactionArgs...)
		if err != nil {
			log.Printf("Error fetching comment reaction counts: %v", err)
		} else {
			defer commentCountRows.Close()
			commentCounts := make(map[string][]models.ReactionCount)
			for commentCountRows.Next() {
				var commentID, reactionID string
				var count int
				err := commentCountRows.Scan(&commentID, &reactionID, &count)
				if err != nil {
					log.Printf("Error scanning comment count row: %v", err)
					continue
				}
				commentCounts[commentID] = append(commentCounts[commentID], models.ReactionCount{ReactionID: reactionID, Count: count})
			}

			// Assign counts to comments
			for _, submission := range response.Feed {
				for i := range submission.Comments {
					if counts, exists := commentCounts[submission.Comments[i].ID]; exists {
						submission.Comments[i].Counts = counts
					}
				}
			}
		}
	}

	totalDrawingsQuery := `SELECT COUNT(*) FROM user_submissions WHERE user_id = ?`
	var totalDrawings int
	err = repo.QueryRowContext(ctx, totalDrawingsQuery, userID).Scan(&totalDrawings)
	if err != nil {
		log.Printf("Error fetching total drawings for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}

	// Calculate current streak - consecutive days of submissions (Go implementation)
	var currentStreak int
	rows, err = repo.QueryContext(ctx, `
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
					streak++
					streakStart = streakStart.AddDate(0, 0, -1)
				} else if d.Before(streakStart) {
					break
				}
			}
		}
		currentStreak = streak
	}

	response.Stats = models.UserStats{
		TotalDrawings: totalDrawings,
		CurrentStreak: currentStreak,
	}

	favQuery := `SELECT id, submission_id, created_at, order_num FROM user_favorite_submissions WHERE user_id = ? ORDER BY order_num ASC`
	favRows, err := repo.QueryContext(ctx, favQuery, userID)
	if err != nil {
		log.Printf("Error fetching favorites for user %s: %v", userID, err)
		response.Favorites = []*models.FavoriteSubmission{}
	} else {
		defer favRows.Close()
		response.Favorites = []*models.FavoriteSubmission{}
		favoriteSet := make(map[string]struct{})
		for favRows.Next() {
			var favID, favSubmissionID string
			var favCreatedAt time.Time
			var favOrderNum int
			err := favRows.Scan(&favID, &favSubmissionID, &favCreatedAt, &favOrderNum)
			if err != nil {
				log.Printf("Error scanning favorite row: %v", err)
				continue
			}
			// Find the full UserPromptSubmission in subMap
			sub, exists := subMap[favSubmissionID]
			if !exists {
				continue // skip if not found
			}
			favoriteSet[favSubmissionID] = struct{}{}
			fav := &models.FavoriteSubmission{
				ID:         favID,
				Submission: *sub,
				CreatedAt:  favCreatedAt,
				OrderNum:   favOrderNum,
			}
			response.Favorites = append(response.Favorites, fav)
		}
		// Set IsFavorite only for user's own submissions
		for _, sub := range response.Prompts {
			if _, ok := favoriteSet[sub.ID]; ok {
				sub.IsFavorite = true
			}
		}
	}

	return response, nil
}

func GetUserFriends(repo *sql.DB, ctx context.Context, userID string) ([]string, error) {
	query := `
		SELECT friend_id FROM friendships
		WHERE user_id = ?
		UNION
		SELECT user_id FROM friendships
		WHERE friend_id = ?
	`
	rows, err := repo.QueryContext(ctx, query, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var friends []string
	for rows.Next() {
		var friendID string
		if err := rows.Scan(&friendID); err != nil {
			return nil, err
		}
		friends = append(friends, friendID)
	}
	return friends, nil
}

func CreateUser(repo *sql.DB, ctx context.Context, username string, email string) (*models.User, error) {
	var user models.User
	insertSQL := `
        INSERT INTO users (id, username, email)
        VALUES (?, ?, ?)
        RETURNING id, username, email
    `
	err := repo.QueryRowContext(ctx, insertSQL, uuid.New().String(), username, email).Scan(&user.ID, &user.Username, &user.Email)

	return &user, err
}

// GetAllUsers gets all users with optional username search
func GetAllUsers(repo *sql.DB, ctx context.Context, searchQuery string) ([]models.User, error) {
	var query string
	var args []interface{}

	if searchQuery != "" {
		query = `SELECT id, username, email, role, created_at FROM users WHERE username LIKE ? ORDER BY username ASC`
		args = []interface{}{"%" + searchQuery + "%"}
	} else {
		query = `SELECT id, username, email, role, created_at FROM users ORDER BY username ASC`
	}

	rows, err := repo.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt)
		if err != nil {
			log.Printf("Error scanning user row: %v", err)
			continue
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}


