package db

import (
	"context"
	"crypto/rand"
	"crypto/sha1"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/utils"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"
)

func GetUserFromDB(repo *sql.DB, ctx context.Context, userID string) (User, error) {
	query := `SELECT id, username, email, created_at FROM users WHERE id = ?`

	row := repo.QueryRowContext(ctx, query, userID)

	var user User
	err := row.Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return User{}, err
		}
		// Log the error for debugging
		log.Printf("Error fetching user %s: %v", userID, err)
		return User{}, fmt.Errorf("failed to fetch user: %w", err)
	}

	return user, nil
}

func GetDailyPromptFromDB(repo *sql.DB, ctx context.Context, dateStr string) (DailyPrompt, error) {
	query := `SELECT day, colors, prompt FROM daily_prompts WHERE day = ?`
	row := repo.QueryRowContext(ctx, query, dateStr)

	var prompt DailyPrompt
	var colorsJSON string

	err := row.Scan(&prompt.Day, &colorsJSON, &prompt.Prompt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DailyPrompt{}, sql.ErrNoRows
		}
		return DailyPrompt{}, fmt.Errorf("error scanning daily prompt for %s: %w", dateStr, err)
	}

	// Parse the JSON array of colors
	err = json.Unmarshal([]byte(colorsJSON), &prompt.Colors)
	if err != nil {
		return DailyPrompt{}, fmt.Errorf("error parsing colors JSON: %w", err)
	}

	// Format the date string correctly
	t, parseErr := time.Parse(time.RFC3339, prompt.Day+"T00:00:00Z")
	if parseErr == nil {
		prompt.Day = utils.GetFormattedDate(t)
	} else {
		log.Printf("Warning: Could not parse date '%s' from DB: %v", prompt.Day, parseErr)
	}

	return prompt, nil
}

func GenerateAndInsertDailyPrompt(repo *sql.DB, ctx context.Context, dateStr string) (DailyPrompt, error) {
	// Double-check if another request inserted the prompt while waiting for the lock
	existingPrompt, err := GetDailyPromptFromDB(repo, ctx, dateStr)
	if err == nil {
		return existingPrompt, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return DailyPrompt{}, fmt.Errorf("error checking for existing prompt during generation: %w", err)
	}

	// Generate a new unique prompt for the day
	h := sha1.New()
	h.Write([]byte(dateStr + "-prompt-seed-v2-db"))
	promptHash := hex.EncodeToString(h.Sum(nil))

	colors := []string{
		fmt.Sprintf("#%s", promptHash[0:6]),
		fmt.Sprintf("#%s", promptHash[6:12]),
		fmt.Sprintf("#%s", promptHash[12:18]),
	}

	// Convert colors to JSON
	colorsJSON, err := json.Marshal(colors)
	if err != nil {
		return DailyPrompt{}, fmt.Errorf("error marshaling colors to JSON: %w", err)
	}

	newPrompt := DailyPrompt{
		Day:    dateStr,
		Colors: colors,
		Prompt: "an anonymous hippopotamus",
	}

	// Insert into the database
	insertSQL := `
        INSERT INTO daily_prompts (day, colors, prompt)
        VALUES (?, ?, ?)
        ON CONFLICT (day) DO NOTHING
    `
	_, err = repo.ExecContext(ctx, insertSQL, newPrompt.Day, string(colorsJSON), newPrompt.Prompt)
	if err != nil {
		return DailyPrompt{}, fmt.Errorf("failed to insert new daily prompt for %s: %w", dateStr, err)
	}

	log.Printf("Generated and inserted new prompt for date: %s", dateStr)
	return newPrompt, nil
}

func CreateUser(repo *sql.DB, ctx context.Context, username string, email string) (*User, error) {
	var user User
	insertSQL := `
        INSERT INTO users (id, username, email)
        VALUES (lower(hex(randomblob(16))), ?, ?)
        RETURNING id, username, email
    `
	err := repo.QueryRowContext(ctx, insertSQL, username, email).Scan(&user.ID, &user.Username, &user.Email)

	return &user, err
}

func GetUserByEmail(repo *sql.DB, ctx context.Context, email string) (*User, error) {
	var user User
	query := `SELECT id, username, email, created_at FROM users WHERE email = ?`
	err := repo.QueryRowContext(ctx, query, email).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func GetUserByID(repo *sql.DB, ctx context.Context, userID string) (*User, error) {
	var user User
	query := `SELECT id, username, email, created_at FROM users WHERE id = ?`
	err := repo.QueryRowContext(ctx, query, userID).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func CheckHasSubmittedForDay(repo *sql.DB, ctx context.Context, userID string, todayStr string) (bool, error) {
	checkQuery := `SELECT EXISTS(SELECT 1 FROM user_submissions WHERE user_id = ? AND day = ?)`
	var hasSubmitted bool
	err := repo.QueryRowContext(ctx, checkQuery, userID, todayStr).Scan(&hasSubmitted)

	return hasSubmitted, err
}

func CreateVerificationToken(repo *sql.DB, ctx context.Context, userID string, email string) (string, error) {
	// Generate a random token using crypto/rand
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	// Set expiration to 1 hour from now
	expiresAt := time.Now().Add(1 * time.Hour)

	query := `
        INSERT INTO verification_tokens (token, user_id, email, expires_at)
        VALUES (?, ?, ?, ?)
    `

	_, err := repo.ExecContext(ctx, query, token, userID, email, expiresAt)

	return token, err
}

func VerifyToken(repo *sql.DB, ctx context.Context, token string) (*User, error) {
	query := `
        SELECT u.id, u.username, u.email
        FROM verification_tokens vt
        JOIN users u ON vt.user_id = u.id
        WHERE vt.token = ? AND vt.expires_at > CURRENT_TIMESTAMP
    `

	var user User
	err := repo.QueryRowContext(ctx, query, token).Scan(&user.ID, &user.Username, &user.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("invalid or expired token")
		}
		return nil, fmt.Errorf("error verifying token: %w", err)
	}

	// Delete the used token
	_, err = repo.ExecContext(ctx, "DELETE FROM verification_tokens WHERE token = ?", token)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func GetUserDataFromDB(repo *sql.DB, ctx context.Context, userID string, cfg *config.Config) (GetMeResponse, error) {
	var response GetMeResponse

	userQuery := `SELECT id, username, email, created_at FROM users WHERE id = ?`
	var user User
	err := repo.QueryRowContext(ctx, userQuery, userID).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)
	if err != nil {
		log.Printf("Error fetching user info for user %s: %v", userID, err)
		return GetMeResponse{}, err
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
		return GetMeResponse{}, err
	}
	defer friendsRows.Close()
	response.Friends = []User{}
	friendIDs := []string{}
	for friendsRows.Next() {
		var friend User
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
		return GetMeResponse{}, err
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
		return GetMeResponse{}, err
	}
	defer rows.Close()

	// Map submission_id to UserPromptSubmission
	subMap := make(map[string]*UserPromptSubmission)
	response.Feed = []*UserPromptSubmission{}
	response.Prompts = []*UserPromptSubmission{}

	for rows.Next() {
		var (
			subID, day, colorsJSON, prompt, subUserID, subUsername, subUserEmail string
			subUserCreatedAt, subCreatedAt time.Time
			commentID, commentText, commentUserID, commentUsername, commentUserEmail sql.NullString
			commentUserCreatedAt, commentCreatedAt sql.NullTime
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
			submission := UserPromptSubmission{
				ID:       subID,
				Day:      day,
				Colors:   colors,
				Prompt:   prompt,
				User: User{
					ID:        subUserID,
					Username:  subUsername,
					Email:     subUserEmail,
					CreatedAt: subUserCreatedAt,
				},
				ImageUrl:  utils.GetImageUrl(cfg, utils.GetImageFilename(subUserID, subID)),
				Comments:  []Comment{},
				Reactions: []Reaction{},
				Counts:    []ReactionCount{},
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
			comment := Comment{
				ID: commentID.String,
				User: User{
					ID:        commentUserID.String,
					Username:  commentUsername.String,
					Email:     commentUserEmail.String,
					CreatedAt: commentUserCreatedAt.Time,
				},
				Text:      commentText.String,
				CreatedAt: commentCreatedAt.Time,
				Reactions: []Reaction{},
				Counts:    []ReactionCount{},
			}
			sub.Comments = append(sub.Comments, comment)
		}
	}
	if err = rows.Err(); err != nil {
		log.Printf("Error iterating submission+comment rows: %v", err)
		return GetMeResponse{}, err
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
				var reaction Reaction
				var user User
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
					sub.Counts = append(sub.Counts, ReactionCount{ReactionID: reactionID, Count: count})
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
			commentReactions := make(map[string][]Reaction)
			for commentReactionRows.Next() {
				var commentID string
				var reaction Reaction
				var user User
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
			commentCounts := make(map[string][]ReactionCount)
			for commentCountRows.Next() {
				var commentID, reactionID string
				var count int
				err := commentCountRows.Scan(&commentID, &reactionID, &count)
				if err != nil {
					log.Printf("Error scanning comment count row: %v", err)
					continue
				}
				commentCounts[commentID] = append(commentCounts[commentID], ReactionCount{ReactionID: reactionID, Count: count})
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
		return GetMeResponse{}, err
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
	
	response.Stats = UserStats{
		TotalDrawings: totalDrawings,
		CurrentStreak: currentStreak,
	}

	favQuery := `SELECT id, submission_id, created_at, order_num FROM user_favorite_submissions WHERE user_id = ? ORDER BY order_num DESC`
	favRows, err := repo.QueryContext(ctx, favQuery, userID)
	if err != nil {
		log.Printf("Error fetching favorites for user %s: %v", userID, err)
		response.Favorites = []*FavoriteSubmission{}
	} else {
		defer favRows.Close()
		response.Favorites = []*FavoriteSubmission{}
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
			fav := &FavoriteSubmission{
				ID:        favID,
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

func GetUserProfileFromDB(repo *sql.DB, ctx context.Context, userID string, cfg *config.Config) (GetMeResponse, error) {
	var response GetMeResponse

	userQuery := `SELECT id, username, email, created_at FROM users WHERE id = ?`
	var user User
	err := repo.QueryRowContext(ctx, userQuery, userID).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)
	if err != nil {
		log.Printf("Error fetching user info for user %s: %v", userID, err)
		return GetMeResponse{}, err
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
		return GetMeResponse{}, err
	}
	defer friendsRows.Close()
	response.Friends = []User{}
	friendIDs := []string{}
	for friendsRows.Next() {
		var friend User
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
		return GetMeResponse{}, err
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
		return GetMeResponse{}, err
	}
	defer rows.Close()

	// Map submission_id to UserPromptSubmission
	subMap := make(map[string]*UserPromptSubmission)
	response.Feed = []*UserPromptSubmission{}
	response.Prompts = []*UserPromptSubmission{}

	for rows.Next() {
		var (
			subID, day, colorsJSON, prompt, subUserID, subUsername, subUserEmail string
			subUserCreatedAt, subCreatedAt time.Time
			commentID, commentText, commentUserID, commentUsername, commentUserEmail sql.NullString
			commentUserCreatedAt, commentCreatedAt sql.NullTime
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
			submission := UserPromptSubmission{
				ID:       subID,
				Day:      day,
				Colors:   colors,
				Prompt:   prompt,
				User: User{
					ID:        subUserID,
					Username:  subUsername,
					Email:     subUserEmail,
					CreatedAt: subUserCreatedAt,
				},
				ImageUrl:  utils.GetImageUrl(cfg, utils.GetImageFilename(subUserID, subID)),
				Comments:  []Comment{},
				Reactions: []Reaction{},
				Counts:    []ReactionCount{},
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
			comment := Comment{
				ID: commentID.String,
				User: User{
					ID:        commentUserID.String,
					Username:  commentUsername.String,
					Email:     commentUserEmail.String,
					CreatedAt: commentUserCreatedAt.Time,
				},
				Text:      commentText.String,
				CreatedAt: commentCreatedAt.Time,
				Reactions: []Reaction{},
				Counts:    []ReactionCount{},
			}
			sub.Comments = append(sub.Comments, comment)
		}
	}
	if err = rows.Err(); err != nil {
		log.Printf("Error iterating submission+comment rows: %v", err)
		return GetMeResponse{}, err
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
				var reaction Reaction
				var user User
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
					sub.Counts = append(sub.Counts, ReactionCount{ReactionID: reactionID, Count: count})
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
			commentReactions := make(map[string][]Reaction)
			for commentReactionRows.Next() {
				var commentID string
				var reaction Reaction
				var user User
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
			commentCounts := make(map[string][]ReactionCount)
			for commentCountRows.Next() {
				var commentID, reactionID string
				var count int
				err := commentCountRows.Scan(&commentID, &reactionID, &count)
				if err != nil {
					log.Printf("Error scanning comment count row: %v", err)
					continue
				}
				commentCounts[commentID] = append(commentCounts[commentID], ReactionCount{ReactionID: reactionID, Count: count})
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
		return GetMeResponse{}, err
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
	
	response.Stats = UserStats{
		TotalDrawings: totalDrawings,
		CurrentStreak: currentStreak,
	}

	favQuery := `SELECT id, submission_id, created_at, order_num FROM user_favorite_submissions WHERE user_id = ? ORDER BY order_num DESC`
	favRows, err := repo.QueryContext(ctx, favQuery, userID)
	if err != nil {
		log.Printf("Error fetching favorites for user %s: %v", userID, err)
		response.Favorites = []*FavoriteSubmission{}
	} else {
		defer favRows.Close()
		response.Favorites = []*FavoriteSubmission{}
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
			fav := &FavoriteSubmission{
				ID:        favID,
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

// GetReactionsForSubmission fetches all reactions for a submission
func GetReactionsForSubmission(repo *sql.DB, ctx context.Context, submissionID string) ([]Reaction, error) {
	query := `
		SELECT 
			r.id,
			r.reaction_id,
			r.created_at,
			u.id,
			u.username,
			u.email,
			u.created_at
		FROM reactions r
		JOIN users u ON r.user_id = u.id
		WHERE r.content_type = 'submission' AND r.content_id = ?
		ORDER BY r.created_at ASC
	`
	
	rows, err := repo.QueryContext(ctx, query, submissionID)
	if err != nil {
		return []Reaction{}, fmt.Errorf("error fetching reactions for submission: %w", err)
	}
	defer rows.Close()

	reactions := []Reaction{}
	for rows.Next() {
		var reaction Reaction
		var user User
		err := rows.Scan(
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
		reactions = append(reactions, reaction)
	}

	// Ensure we always return a non-nil slice
	if reactions == nil {
		reactions = []Reaction{}
	}
	
	return reactions, nil
}

// GetReactionsForComment fetches all reactions for a comment
func GetReactionsForComment(repo *sql.DB, ctx context.Context, commentID string) ([]Reaction, error) {
	query := `
		SELECT 
			r.id,
			r.reaction_id,
			r.created_at,
			u.id,
			u.username,
			u.email,
			u.created_at
		FROM reactions r
		JOIN users u ON r.user_id = u.id
		WHERE r.content_type = 'comment' AND r.content_id = ?
		ORDER BY r.created_at ASC
	`
	
	rows, err := repo.QueryContext(ctx, query, commentID)
	if err != nil {
		return []Reaction{}, fmt.Errorf("error fetching reactions for comment: %w", err)
	}
	defer rows.Close()

	reactions := []Reaction{}
	for rows.Next() {
		var reaction Reaction
		var user User
		err := rows.Scan(
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
		reactions = append(reactions, reaction)
	}

	// Ensure we always return a non-nil slice
	if reactions == nil {
		reactions = []Reaction{}
	}
	
	return reactions, nil
}

// ToggleReaction adds or removes a reaction for a user using atomic SQL operation
func ToggleReaction(repo *sql.DB, ctx context.Context, userID, contentType, contentID, reactionID string) error {
	// Validate that the content exists based on content type
	var contentExistsQuery string
	switch contentType {
	case "submission":
		contentExistsQuery = `SELECT 1 FROM user_submissions WHERE id = ?`
	case "comment":
		contentExistsQuery = `SELECT 1 FROM comments WHERE id = ?`
	default:
		return fmt.Errorf("invalid content type: %s", contentType)
	}

	var contentExists int
	err := repo.QueryRowContext(ctx, contentExistsQuery, contentID).Scan(&contentExists)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("%s %s does not exist", contentType, contentID)
		}
		return fmt.Errorf("error checking if %s exists: %w", contentType, err)
	}

	// Check if the reaction already exists
	existsQuery := `
		SELECT 1 FROM reactions 
		WHERE user_id = ? AND content_type = ? AND content_id = ? AND reaction_id = ?
	`
	var exists int
	err = repo.QueryRowContext(ctx, existsQuery, userID, contentType, contentID, reactionID).Scan(&exists)
	
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("error checking if reaction exists: %w", err)
	}

	if errors.Is(err, sql.ErrNoRows) {
		// Reaction doesn't exist, insert it
		insertQuery := `
			INSERT INTO reactions (user_id, content_type, content_id, reaction_id)
			VALUES (?, ?, ?, ?)
		`
		_, err = repo.ExecContext(ctx, insertQuery, userID, contentType, contentID, reactionID)
		if err != nil {
			return fmt.Errorf("error adding reaction: %w", err)
		}
	} else {
		// Reaction exists, remove it
		deleteQuery := `
			DELETE FROM reactions 
			WHERE user_id = ? AND content_type = ? AND content_id = ? AND reaction_id = ?
		`
		_, err = repo.ExecContext(ctx, deleteQuery, userID, contentType, contentID, reactionID)
		if err != nil {
			return fmt.Errorf("error removing reaction: %w", err)
		}
	}
	
	return nil
}

// GetReactionCountsForSubmission fetches reaction counts by type for a submission
func GetReactionCountsForSubmission(repo *sql.DB, ctx context.Context, submissionID string) ([]ReactionCount, error) {
	query := `
		SELECT 
			reaction_id,
			COUNT(*) as count
		FROM reactions
		WHERE content_type = 'submission' AND content_id = ?
		GROUP BY reaction_id
		ORDER BY count DESC, reaction_id ASC
	`
	
	rows, err := repo.QueryContext(ctx, query, submissionID)
	if err != nil {
		return []ReactionCount{}, fmt.Errorf("error fetching reaction counts for submission: %w", err)
	}
	defer rows.Close()

	counts := []ReactionCount{}
	for rows.Next() {
		var count ReactionCount
		err := rows.Scan(&count.ReactionID, &count.Count)
		if err != nil {
			log.Printf("Error scanning reaction count row: %v", err)
			continue
		}
		counts = append(counts, count)
	}

	// Ensure we always return a non-nil slice
	if counts == nil {
		counts = []ReactionCount{}
	}

	return counts, nil
}

// GetReactionCountsForComment fetches reaction counts by type for a comment
func GetReactionCountsForComment(repo *sql.DB, ctx context.Context, commentID string) ([]ReactionCount, error) {
	query := `
		SELECT 
			reaction_id,
			COUNT(*) as count
		FROM reactions
		WHERE content_type = 'comment' AND content_id = ?
		GROUP BY reaction_id
		ORDER BY count DESC, reaction_id ASC
	`
	
	rows, err := repo.QueryContext(ctx, query, commentID)
	if err != nil {
		return []ReactionCount{}, fmt.Errorf("error fetching reaction counts for comment: %w", err)
	}
	defer rows.Close()

	counts := []ReactionCount{}
	for rows.Next() {
		var count ReactionCount
		err := rows.Scan(&count.ReactionID, &count.Count)
		if err != nil {
			log.Printf("Error scanning reaction count row: %v", err)
			continue
		}
		counts = append(counts, count)
	}

	// Ensure we always return a non-nil slice
	if counts == nil {
		counts = []ReactionCount{}
	}

	return counts, nil
}


func GetActivityFeed(repo *sql.DB, ctx context.Context, userID string, lastReadID string, cfg *config.Config) ([]Activity, error) {
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
		Prompt   string
		UserID   string
	}{ }
	for subRows.Next() {
		var id, prompt, subUserID string
		if err := subRows.Scan(&id, &prompt, &subUserID); err == nil {
			subMap[id] = struct {
				Prompt   string
				UserID   string
			}{Prompt: prompt, UserID: subUserID}
		}
	}
	if len(subMap) == 0 {
		return []Activity{}, nil
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

	activities := []Activity{}
	for commentRows.Next() {
		var cID, cUserID, cUsername, cEmail, cText, cSubmissionID string
		var cUserCreatedAt, cCreatedAt time.Time
		if err := commentRows.Scan(&cID, &cUserID, &cUsername, &cEmail, &cUserCreatedAt, &cText, &cCreatedAt, &cSubmissionID); err == nil {
			if cUserID == userID { continue } // skip own actions
			if !friendIDs[cUserID] { continue } // only friends' actions
			info := subMap[cSubmissionID]
			activities = append(activities, Activity{
				ID:     "comment-" + cID,
				User:   User{ID: cUserID, Username: cUsername, Email: cEmail, CreatedAt: cUserCreatedAt},
				Action: ActivityActionComment,
				Date:   cCreatedAt,
				Comment: &Comment{
					ID:        cID,
					User:      User{ID: cUserID, Username: cUsername, Email: cEmail, CreatedAt: cUserCreatedAt},
					Text:      cText,
					CreatedAt: cCreatedAt,
				},
				Submission: &struct {
					ID       string `json:"id"`
					Prompt   string `json:"prompt"`
					ImageUrl string `json:"imageUrl"`
				}{
					ID: cSubmissionID,
					Prompt: info.Prompt,
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
			if rUserID == userID { continue } // skip own actions
			if !friendIDs[rUserID] { continue } // only friends' actions
			info := subMap[rContentID]
			activities = append(activities, Activity{
				ID:     "reaction-" + rID,
				User:   User{ID: rUserID, Username: rUsername, Email: rEmail, CreatedAt: rUserCreatedAt},
				Action: ActivityActionReaction,
				Date:   rCreatedAt,
				Reaction: &Reaction{
					ID:         rID,
					User:       User{ID: rUserID, Username: rUsername, Email: rEmail, CreatedAt: rUserCreatedAt},
					ReactionID: rReactionID,
					CreatedAt:  rCreatedAt,
				},
				Submission: &struct {
					ID       string `json:"id"`
					Prompt   string `json:"prompt"`
					ImageUrl string `json:"imageUrl"`
				}{
					ID: rContentID,
					Prompt: info.Prompt,
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

// GetLastReadActivityID returns the last_read_activity_id for a user
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

// SetLastReadActivityID sets the last_read_activity_id for a user
func SetLastReadActivityID(repo *sql.DB, ctx context.Context, userID, activityID string) error {
	query := `INSERT INTO activity_reads (user_id, last_read_activity_id, last_read_date) VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET last_read_activity_id = excluded.last_read_activity_id, last_read_date = excluded.last_read_date`
	_, err := repo.ExecContext(ctx, query, userID, activityID)
	return err
}

// ToggleFavoriteSubmission toggles a favorite for a user's own submission.
func ToggleFavoriteSubmission(repo *sql.DB, ctx context.Context, userID, submissionID string) (added bool, err error) {
	// Check if the submission belongs to the user
	var ownerID string
	err = repo.QueryRowContext(ctx, "SELECT user_id FROM user_submissions WHERE id = ?", submissionID).Scan(&ownerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, errors.New("submission not found")
		}
		return false, err
	}
	if ownerID != userID {
		return false, errors.New("can only favorite your own submission")
	}

	// Check if already favorited
	var favID string
	err = repo.QueryRowContext(ctx, "SELECT id FROM user_favorite_submissions WHERE user_id = ? AND submission_id = ?", userID, submissionID).Scan(&favID)
	if err == nil {
		// Already favorited, so remove
		_, delErr := repo.ExecContext(ctx, "DELETE FROM user_favorite_submissions WHERE id = ?", favID)
		if delErr != nil {
			return false, delErr
		}
		return false, nil // removed
	} else if err != sql.ErrNoRows {
		return false, err
	}

	// Not favorited, so add
	// Get next order_num
	var nextOrder int
	err = repo.QueryRowContext(ctx, "SELECT COALESCE(MAX(order_num), 0) + 1 FROM user_favorite_submissions WHERE user_id = ?", userID).Scan(&nextOrder)
	if err != nil {
		return false, err
	}
	_, insErr := repo.ExecContext(ctx, `INSERT INTO user_favorite_submissions (id, user_id, submission_id, order_num) VALUES (lower(hex(randomblob(16))), ?, ?, ?)`, userID, submissionID, nextOrder)
	if insErr != nil {
		return false, insErr
	}
	return true, nil // added
}

// SwapFavoriteOrder swaps the order_num of two user_favorite_submissions for a user
func SwapFavoriteOrder(repo *sql.DB, ctx context.Context, userID, favID1, favID2 string) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	var order1, order2 int
	// Get order_num for both favorites and check ownership
	row := tx.QueryRowContext(ctx, `SELECT order_num FROM user_favorite_submissions WHERE id = ? AND user_id = ?`, favID1, userID)
	if err = row.Scan(&order1); err != nil {
		return err
	}
	row = tx.QueryRowContext(ctx, `SELECT order_num FROM user_favorite_submissions WHERE id = ? AND user_id = ?`, favID2, userID)
	if err = row.Scan(&order2); err != nil {
		return err
	}

	// Swap the order_num values
	_, err = tx.ExecContext(ctx, `UPDATE user_favorite_submissions SET order_num = CASE WHEN id = ? THEN ? WHEN id = ? THEN ? END WHERE id IN (?, ?) AND user_id = ?`, favID1, order2, favID2, order1, favID1, favID2, userID)
	return err
}

// placeholders returns a string of ?,?,? for IN queries
func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	s := strings.Repeat("?,", n)
	return s[:len(s)-1]
}
