package db

import (
	"context"
	"crypto/sha1"
	"database/sql"
	"drawer-service-backend/internal/utils"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/lib/pq"
)

func GetUserFromDB(repo *sql.DB, ctx context.Context, userID string) (User, error) {
	query := `SELECT id, name, email FROM users WHERE id = $1`
	row := repo.QueryRowContext(ctx, query, userID)

	var user User
	err := row.Scan(&user.ID, &user.Name, &user.Email)

	return user, err
}

func GetDailyPromptFromDB(repo *sql.DB, ctx context.Context, dateStr string) (DailyPrompt, error) {
	query := `SELECT day, colors, prompt FROM daily_prompts WHERE day = $1`
	row := repo.QueryRowContext(ctx, query, dateStr)

	var prompt DailyPrompt
	var colors pq.StringArray // Use pq.StringArray to scan PostgreSQL array type

	err := row.Scan(&prompt.Day, &colors, &prompt.Prompt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DailyPrompt{}, sql.ErrNoRows // Explicitly return ErrNoRows
		}
		return DailyPrompt{}, fmt.Errorf("error scanning daily prompt for %s: %w", dateStr, err)
	}
	prompt.Colors = []string(colors) // Convert pq.StringArray back to []string

	// Format the date string correctly (DB might return timestamp)
	t, parseErr := time.Parse(time.RFC3339, prompt.Day+"T00:00:00Z") // Assume DB returns date part
	if parseErr == nil {
		prompt.Day = utils.GetFormattedDate(t)
	} else {
		// Fallback or log error if parsing fails, though day should be correct format
		log.Printf("Warning: Could not parse date '%s' from DB: %v", prompt.Day, parseErr)
		// Keep the string as is if parsing fails
	}

	return prompt, nil
}

func GenerateAndInsertDailyPrompt(repo *sql.DB, ctx context.Context, dateStr string) (DailyPrompt, error) {
	// Double-check if another request inserted the prompt while waiting for the lock
	existingPrompt, err := GetDailyPromptFromDB(repo, ctx, dateStr)
	if err == nil {
		return existingPrompt, nil // Return the prompt inserted by another request
	}
	if !errors.Is(err, sql.ErrNoRows) {
		// An actual error occurred during the double-check query
		return DailyPrompt{}, fmt.Errorf("error checking for existing prompt during generation: %w", err)
	}
	// sql.ErrNoRows means we are clear to generate and insert.

	// --- Generate a new unique prompt for the day ---
	h := sha1.New()
	h.Write([]byte(dateStr + "-prompt-seed-v2-db")) // Use a different seed if needed
	promptHash := hex.EncodeToString(h.Sum(nil))

	newPrompt := DailyPrompt{
		Day: dateStr,
		Colors: []string{
			fmt.Sprintf("#%s", promptHash[0:6]),
			fmt.Sprintf("#%s", promptHash[6:12]),
			fmt.Sprintf("#%s", promptHash[12:18]),
		},
		Prompt: "an anonymous hippopotamus",
	}
	// ------------------------------------------------

	// Insert into the database
	insertSQL := `
        INSERT INTO daily_prompts (day, colors, prompt)
        VALUES ($1, $2, $3)
        ON CONFLICT (day) DO NOTHING
    `
	_, err = repo.ExecContext(ctx, insertSQL, newPrompt.Day, pq.Array(newPrompt.Colors), newPrompt.Prompt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" { // Unique violation
			log.Printf("Unique constraint violation on inserting prompt for %s (likely race condition, recovering)", dateStr)
			// Attempt to fetch the prompt that was inserted by the other process
			return GetDailyPromptFromDB(repo, ctx, dateStr)
		}
		return DailyPrompt{}, fmt.Errorf("failed to insert new daily prompt for %s: %w", dateStr, err)
	}

	log.Printf("Generated and inserted new prompt for date: %s", dateStr)
	return newPrompt, nil
}

func GetUserSubmissionsFromDB(repo *sql.DB, ctx context.Context, userID string) ([]UserPromptSubmission, error) {
	query := `
	SELECT
		us.day, us.file_path, dp.colors, dp.prompt, u.id, u.name, u.email
	FROM
		user_submissions us
	JOIN
		daily_prompts dp ON us.day = dp.day
	JOIN
		users u ON us.user_id = u.id
	WHERE
		us.user_id = $1
	ORDER BY
		us.created_at DESC -- Order by when the submission was created
	`

	rows, err := repo.QueryContext(ctx, query, userID)
	if err != nil {
		log.Printf("Error fetching submissions for user %s: %v", userID, err)
		return nil, err
	}
	defer rows.Close()

	UserPrompts := []UserPromptSubmission{}
	for rows.Next() {
		var p UserPromptSubmission
		var colors pq.StringArray   // Use pq.StringArray for scanning array
		var submissionDay time.Time // Scan date directly
		var userID, userName, userEmail string

		err := rows.Scan(&submissionDay, &p.ImageURL, &colors, &p.Prompt, &userID, &userName, &userEmail)
		if err != nil {
			log.Printf("Error scanning submission row for user %s: %v", userID, err)
			continue // Skip problematic row
		}
		p.Day = utils.GetFormattedDate(submissionDay) // Format date correctly
		p.Colors = []string(colors)                   // Convert to []string

		// Populate user data
		p.User = User{
			ID:    userID,
			Name:  userName,
			Email: userEmail,
		}

		UserPrompts = append(UserPrompts, p)
	}

	return UserPrompts, nil
}

func GetUserAndFriendsSubmissionsFromDB(repo *sql.DB, ctx context.Context, userID string) (map[string][]UserPromptSubmission, error) {
	query := `
	SELECT
		us.day, us.file_path, dp.colors, dp.prompt, u.id, u.name, u.email
	FROM
		user_submissions us
	JOIN
		daily_prompts dp ON us.day = dp.day
	JOIN
		users u ON us.user_id = u.id
	WHERE
		us.user_id = $1 OR us.user_id IN (
			SELECT friend_id FROM friendships WHERE user_id = $1 or friend_id = $1
		)
	ORDER BY
		dp.day DESC
	`

	rows, err := repo.QueryContext(ctx, query, userID)
	if err != nil {
		log.Printf("Error fetching submissions for user %s: %v", userID, err)
		return nil, err
	}
	defer rows.Close()

	// Create a map to group submissions by day
	feed := make(map[string][]UserPromptSubmission)

	for rows.Next() {
		var p UserPromptSubmission
		var colors pq.StringArray   // Use pq.StringArray for scanning array
		var submissionDay time.Time // Scan date directly
		var userID, userName, userEmail string

		err := rows.Scan(&submissionDay, &p.ImageURL, &colors, &p.Prompt, &userID, &userName, &userEmail)
		if err != nil {
			log.Printf("Error scanning submission row for user %s: %v", userID, err)
			continue // Skip problematic row
		}
		p.Day = utils.GetFormattedDate(submissionDay) // Format date correctly
		p.Colors = []string(colors)                   // Convert to []string

		// Populate user data
		p.User = User{
			ID:    userID,
			Name:  userName,
			Email: userEmail,
		}

		// Group by day
		dayKey := p.Day // Assuming p.Day is in the format you want (e.g., "04-30-2025")
		feed[dayKey] = append(feed[dayKey], p)
	}

	// Check for errors during row iteration
	if err = rows.Err(); err != nil {
		log.Printf("Error iterating submission rows for user %s: %v", userID, err)
		return nil, err
	}

	return feed, nil
}

func GetUserFriendsFromDB(repo *sql.DB, ctx context.Context, userID string) ([]User, error) {
	query := `
		SELECT u.id, u.name, u.email
		FROM friendships f
		JOIN users u ON f.friend_id = u.id
		WHERE f.user_id = $1 OR f.friend_id = $1
	`

	rows, err := repo.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var friends []User
	for rows.Next() {
		var friend User
		if err := rows.Scan(&friend.ID, &friend.Name, &friend.Email); err != nil {
			return nil, err
		}
		friends = append(friends, friend)
	}

	// Check for errors during row iteration
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Return an empty slice if no friends were found
	if len(friends) == 0 {
		return []User{}, nil
	}

	return friends, nil
}

func CreateUser(repo *sql.DB, ctx context.Context, name string, email string) (string, error) {
	var userID string
	insertSQL := `
        INSERT INTO users (name, email)
        VALUES ($1, $2)
        RETURNING id
    `
	err := repo.QueryRowContext(ctx, insertSQL, name, email).Scan(&userID)
	if err != nil {
		log.Printf("Error inserting user: %v", err)
		return "", err
	}
	return userID, nil
}

func GetUserByEmail(repo *sql.DB, ctx context.Context, email string) (*User, error) {
	var user User
	query := `SELECT id, name, email FROM users WHERE email = $1`
	err := repo.QueryRowContext(ctx, query, email).Scan(&user.ID, &user.Name, &user.Email)
	if err != nil {
		log.Printf("Error fetching user by email: %v", err)
		return nil, err
	}
	return &user, nil
}

func GetUserByID(repo *sql.DB, ctx context.Context, userID string) (*User, error) {
	var user User
	query := `SELECT id, name, email FROM users WHERE id = $1`
	err := repo.QueryRowContext(ctx, query, userID).Scan(&user.ID, &user.Name, &user.Email)
	if err != nil {
		log.Printf("Error fetching user by ID: %v", err)
		return nil, err
	}
	return &user, nil
}

func CheckHasSubmittedForDay(repo *sql.DB, ctx context.Context, userID string, todayStr string) (bool, error) {
	checkQuery := `SELECT EXISTS(SELECT 1 FROM user_submissions WHERE user_id = $1 AND day = $2)`
	var hasSubmitted bool
	err := repo.QueryRowContext(ctx, checkQuery, userID, todayStr).Scan(&hasSubmitted)

	if err != nil {
		log.Printf("Error getting user submission")
		return false, err
	}

	return hasSubmitted, nil
}
