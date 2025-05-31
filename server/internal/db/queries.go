package db

import (
	"context"
	"crypto/rand"
	"crypto/sha1"
	"database/sql"
	"drawer-service-backend/internal/utils"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
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

func GetUserDataFromDB(repo *sql.DB, ctx context.Context, userID string) (GetMeResponse, error) {
	query := `
	WITH user_submissions_cte AS (
		SELECT
			us.day,
			us.canvas_data,
			dp.colors,
			dp.prompt,
			u.id as user_id,
			u.username,
			u.email,
			us.created_at,
			us.created_at as submission_created_at
		FROM
			user_submissions us
		JOIN
			daily_prompts dp ON us.day = dp.day
		JOIN
			users u ON us.user_id = u.id
		WHERE
			us.user_id = ?
	),
	friend_submissions AS (
		SELECT
			us.day,
			us.canvas_data,
			dp.colors,
			dp.prompt,
			u.id as user_id,
			u.username,
			u.email,
			us.created_at,
			us.created_at as submission_created_at
		FROM
			user_submissions us
		JOIN
			daily_prompts dp ON us.day = dp.day
		JOIN
			users u ON us.user_id = u.id
		WHERE
			us.user_id IN (
				SELECT friend_id FROM friendships WHERE user_id = ?
			)
	),
	friends AS (
		SELECT 
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
	),
	user_stats AS (
		SELECT
			COUNT(*) as total_drawings,
			(
				SELECT COUNT(*)
				FROM user_submissions_cte s1
				WHERE s1.day <= date('now')
				AND NOT EXISTS (
					SELECT 1
					FROM user_submissions_cte s2
					WHERE s2.day = date(s1.day, '-1 day')
				)
				ORDER BY s1.day DESC
				LIMIT 1
			) as current_streak
		FROM user_submissions_cte
	)
	SELECT
		'user' as submission_type,
		day,
		canvas_data,
		colors,
		prompt,
		user_id,
		username,
		email,
		created_at,
		submission_created_at,
		(SELECT total_drawings FROM user_stats) as total_drawings,
		(SELECT current_streak FROM user_stats) as current_streak
	FROM user_submissions_cte
	UNION ALL
	SELECT
		'friend' as submission_type,
		day,
		canvas_data,
		colors,
		prompt,
		user_id,
		username,
		email,
		created_at,
		submission_created_at,
		(SELECT total_drawings FROM user_stats) as total_drawings,
		(SELECT current_streak FROM user_stats) as current_streak
	FROM friend_submissions
	ORDER BY submission_created_at DESC;
	`

	rows, err := repo.QueryContext(ctx, query, userID, userID, userID)
	if err != nil {
		log.Printf("Error fetching user data for user %s: %v", userID, err)
		return GetMeResponse{}, err
	}
	defer rows.Close()

	response := GetMeResponse{
		User:    User{},
		Prompts: []UserPromptSubmission{},
		Feed:    make(map[string][]UserPromptSubmission),
		Friends: []User{},
		Stats:   UserStats{},
	}

	// Track unique friends
	friendMap := make(map[string]User)

	for rows.Next() {
		var submission UserPromptSubmission
		var colorsJSON string
		var submissionDay string
		var userID, userName, userEmail string
		var canvasData string
		var submissionType string
		var userCreatedAt, submissionCreatedAt time.Time
		var totalDrawings, currentStreak int

		err := rows.Scan(
			&submissionType,
			&submissionDay,
			&canvasData,
			&colorsJSON,
			&submission.Prompt,
			&userID,
			&userName,
			&userEmail,
			&userCreatedAt,
			&submissionCreatedAt,
			&totalDrawings,
			&currentStreak,
		)
		if err != nil {
			log.Printf("Error scanning submission row: %v", err)
			continue
		}

		// Parse the JSON array of colors
		err = json.Unmarshal([]byte(colorsJSON), &submission.Colors)
		if err != nil {
			log.Printf("Error parsing colors JSON: %v", err)
			continue
		}

		// Parse the canvas data
		submission.CanvasData = json.RawMessage(canvasData)
		submission.Day = submissionDay

		// Populate user data
		user := User{
			ID:        userID,
			Username:  userName,
			Email:     userEmail,
			CreatedAt: userCreatedAt,
		}
		submission.User = user

		// If this is the main user, set it in the response
		if submissionType == "user" && response.User.ID == "" {
			response.User = user
			response.Stats = UserStats{
				TotalDrawings: totalDrawings,
				CurrentStreak: currentStreak,
			}
		}

		// Add to appropriate collection
		if submissionType == "user" {
			response.Prompts = append(response.Prompts, submission)
		}
		
		// Add to feed
		response.Feed[submission.Day] = append(response.Feed[submission.Day], submission)

		// Track unique friends
		if submissionType == "friend" {
			friendMap[userID] = user
		}
	}

	// Convert friend map to slice
	for _, friend := range friendMap {
		response.Friends = append(response.Friends, friend)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating rows: %v", err)
		return GetMeResponse{}, err
	}

	return response, nil
}
