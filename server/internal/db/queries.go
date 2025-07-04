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

	// 1. Get main user info
	userQuery := `SELECT id, username, email, created_at FROM users WHERE id = ?`
	var user User
	err := repo.QueryRowContext(ctx, userQuery, userID).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)
	if err != nil {
		log.Printf("Error fetching user info for user %s: %v", userID, err)
		return GetMeResponse{}, err
	}
	response.User = user

	// 2. Get user's friends
	friendsQuery := `
		SELECT DISTINCT
			u.id,
			u.username,
			u.email,
			u.created_at
		FROM 
			friendships f
		JOIN 
			users u ON f.friend_id = u.id
		WHERE 
			f.user_id = ?
		ORDER BY u.username`
	friendsRows, err := repo.QueryContext(ctx, friendsQuery, userID)
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

	// 3. Get all relevant submissions (user + friends) and their comments in one query
	submissionIDs := []interface{}{userID}
	whereClause := "us.user_id = ?"
	if len(friendIDs) > 0 {
		whereClause = "(us.user_id = ? OR us.user_id IN (" + strings.Repeat("?,", len(friendIDs)-1) + "?) )"
		for _, id := range friendIDs {
			submissionIDs = append(submissionIDs, id)
		}
	}

	query := `
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
		ORDER BY us.day DESC, c.created_at ASC`

	rows, err := repo.QueryContext(ctx, query, submissionIDs...)
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

	// 4. Fetch reactions and counts for all submissions and comments
	for _, submission := range response.Feed {
		// Get reactions and counts for submission
		reactions, err := GetReactionsForSubmission(repo, ctx, submission.ID)
		if err != nil {
			log.Printf("Error fetching reactions for submission %s: %v", submission.ID, err)
			submission.Reactions = []Reaction{}
		} else {
			submission.Reactions = reactions
		}
		
		// Debug: Check if reactions is nil
		if submission.Reactions == nil {
			log.Printf("WARNING: submission.Reactions is nil for submission %s, setting to empty array", submission.ID)
			submission.Reactions = []Reaction{}
		}

		counts, err := GetReactionCountsForSubmission(repo, ctx, submission.ID)
		if err != nil {
			log.Printf("Error fetching reaction counts for submission %s: %v", submission.ID, err)
			submission.Counts = []ReactionCount{}
		} else {
			submission.Counts = counts
		}
		
		// Debug: Check if counts is nil
		if submission.Counts == nil {
			log.Printf("WARNING: submission.Counts is nil for submission %s, setting to empty array", submission.ID)
			submission.Counts = []ReactionCount{}
		}

		// Get reactions and counts for each comment
		for i := range submission.Comments {
			commentReactions, err := GetReactionsForComment(repo, ctx, submission.Comments[i].ID)
			if err != nil {
				log.Printf("Error fetching reactions for comment: %v", err)
				submission.Comments[i].Reactions = []Reaction{}
			} else {
				submission.Comments[i].Reactions = commentReactions
			}
			
			// Debug: Check if comment reactions is nil
			if submission.Comments[i].Reactions == nil {
				log.Printf("WARNING: comment.Reactions is nil for comment %s, setting to empty array", submission.Comments[i].ID)
				submission.Comments[i].Reactions = []Reaction{}
			}

			commentCounts, err := GetReactionCountsForComment(repo, ctx, submission.Comments[i].ID)
			if err != nil {
				log.Printf("Error fetching reaction counts for comment: %v", err)
				submission.Comments[i].Counts = []ReactionCount{}
			} else {
				submission.Comments[i].Counts = commentCounts
			}
			
			// Debug: Check if comment counts is nil
			if submission.Comments[i].Counts == nil {
				log.Printf("WARNING: comment.Counts is nil for comment %s, setting to empty array", submission.Comments[i].ID)
				submission.Comments[i].Counts = []ReactionCount{}
			}
		}
	}

	// 5. Get user stats
	totalDrawingsQuery := `SELECT COUNT(*) FROM user_submissions WHERE user_id = ?`
	var totalDrawings int
	err = repo.QueryRowContext(ctx, totalDrawingsQuery, userID).Scan(&totalDrawings)
	if err != nil {
		log.Printf("Error fetching total drawings for user %s: %v", userID, err)
		return GetMeResponse{}, err
	}
	currentStreakQuery := `
		WITH RECURSIVE dates AS (
			SELECT date('now') as date
			UNION ALL
			SELECT date(date, '-1 day')
			FROM dates
			WHERE date > (
				SELECT MIN(day)
				FROM user_submissions
				WHERE user_id = ?
			)
		)
		SELECT COUNT(*)
		FROM dates d
		WHERE EXISTS (
			SELECT 1
			FROM user_submissions s
			WHERE s.user_id = ? AND s.day = d.date
		)
		AND NOT EXISTS (
			SELECT 1
			FROM dates d2
			WHERE d2.date < d.date
			AND d2.date > (
				SELECT MAX(day)
				FROM user_submissions s2
				WHERE s2.user_id = ? AND s2.day < d.date
			)
			AND NOT EXISTS (
				SELECT 1
				FROM user_submissions s3
				WHERE s3.user_id = ? AND s3.day = d2.date
			)
		)
	`
	var currentStreak int
	err = repo.QueryRowContext(ctx, currentStreakQuery, userID, userID, userID, userID).Scan(&currentStreak)
	if err != nil {
		log.Printf("Error fetching current streak for user %s: %v", userID, err)
		return GetMeResponse{}, err
	}
	response.Stats = UserStats{
		TotalDrawings: totalDrawings,
		CurrentStreak: currentStreak,
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

// ToggleReaction adds or removes a reaction for a user
func ToggleReaction(repo *sql.DB, ctx context.Context, userID, contentType, contentID, reactionID string) error {
	// Check if reaction already exists
	checkQuery := `
		SELECT id FROM reactions 
		WHERE user_id = ? AND content_type = ? AND content_id = ? AND reaction_id = ?
	`
	
	var existingID string
	err := repo.QueryRowContext(ctx, checkQuery, userID, contentType, contentID, reactionID).Scan(&existingID)
	
	if err == sql.ErrNoRows {
		// Reaction doesn't exist, add it
		insertQuery := `
			INSERT INTO reactions (user_id, content_type, content_id, reaction_id)
			VALUES (?, ?, ?, ?)
		`
		_, err = repo.ExecContext(ctx, insertQuery, userID, contentType, contentID, reactionID)
		if err != nil {
			return fmt.Errorf("error adding reaction: %w", err)
		}
		return nil
	} else if err != nil {
		return fmt.Errorf("error checking existing reaction: %w", err)
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
		return nil
	}
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
