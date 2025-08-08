package queries

import (
	"context"
	"crypto/sha1"
	"database/sql"
	"drawer-service-backend/pkg/db/models"
	"drawer-service-backend/pkg/utils"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

type CheckUserSubmittedTodayParams struct {
	UserID   string
	TodayStr string
}

func CheckUserSubmittedToday(repo *sql.DB, ctx context.Context, userID string) (bool, error) {
	checkQuery := `SELECT EXISTS(SELECT 1 FROM user_submissions WHERE user_id = ? AND day = ?)`
	var hasSubmitted bool

	todayStr := utils.GetFormattedDate(time.Now())

	err := repo.QueryRowContext(ctx, checkQuery, userID, todayStr).Scan(&hasSubmitted)

	return hasSubmitted, err
}

func GetDailyPrompt(repo *sql.DB, ctx context.Context, dateStr string) (models.DailyPrompt, error) {
	query := `SELECT day, colors, prompt FROM daily_prompts WHERE day = ?`
	row := repo.QueryRowContext(ctx, query, dateStr)

	var prompt models.DailyPrompt
	var colorsJSON string

	err := row.Scan(&prompt.Day, &colorsJSON, &prompt.Prompt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.DailyPrompt{}, sql.ErrNoRows
		}
		return models.DailyPrompt{}, fmt.Errorf("error scanning daily prompt for %s: %w", dateStr, err)
	}

	// Parse the JSON array of colors
	err = json.Unmarshal([]byte(colorsJSON), &prompt.Colors)
	if err != nil {
		return models.DailyPrompt{}, fmt.Errorf("error parsing colors JSON: %w", err)
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

type InsertSubmissionRecordParams struct {
	UserID string
	Day    string
}

func InsertSubmissionRecord(repo *sql.DB, ctx context.Context, params InsertSubmissionRecordParams) (string, error) {
	submissionId := uuid.New().String()

	insertQuery := `INSERT INTO user_submissions (id, user_id, day) VALUES (?, ?, ?) returning id`
	_, err := repo.ExecContext(ctx, insertQuery, submissionId, params.UserID, params.Day)

	return submissionId, err
}

func GenerateAndInsertDailyPrompt(repo *sql.DB, ctx context.Context, dateStr string) (models.DailyPrompt, error) {
	// Double-check if another request inserted the prompt while waiting for the lock
	existingPrompt, err := GetDailyPrompt(repo, ctx, dateStr)
	if err == nil {
		return existingPrompt, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return models.DailyPrompt{}, fmt.Errorf("error checking for existing prompt during generation: %w", err)
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
		return models.DailyPrompt{}, fmt.Errorf("error marshaling colors to JSON: %w", err)
	}

	newPrompt := models.DailyPrompt{
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
		return models.DailyPrompt{}, fmt.Errorf("failed to insert new daily prompt for %s: %w", dateStr, err)
	}

	log.Printf("Generated and inserted new prompt for date: %s", dateStr)
	return newPrompt, nil
}

// GetFuturePrompts gets all prompts from today onwards
func GetFuturePrompts(repo *sql.DB, ctx context.Context) ([]models.DailyPrompt, error) {
	today := utils.GetFormattedDate(time.Now())

	query := `SELECT dp.day, dp.colors, dp.prompt, dp.created_by, u.username, u.email, u.created_at, u.avatar_type, u.avatar_url
	FROM daily_prompts dp
	LEFT JOIN users u ON dp.user_id = u.id
	WHERE dp.day >= ? ORDER BY dp.day ASC`
	rows, err := repo.QueryContext(ctx, query, today)
	if err != nil {
		return nil, fmt.Errorf("error querying future prompts: %w", err)
	}
	defer rows.Close()

	var prompts []models.DailyPrompt
	for rows.Next() {
		var (
			day, colorsJSON, prompt                                                                         string
			createdByUserID, createdByUsername, createdByUserEmail, createdByAvatarType, createdByAvatarURL sql.NullString
			createdByUserCreatedAt                                                                          sql.NullTime
		)

		err := rows.Scan(&day, &colorsJSON, &prompt, &createdByUserID, &createdByUsername, &createdByUserEmail, &createdByUserCreatedAt, &createdByAvatarType, &createdByAvatarURL)
		if err != nil {
			log.Printf("Error scanning future prompt row: %v", err)
			continue
		}

		dailyPrompt := models.DailyPrompt{
			Day:    day,
			Prompt: prompt,
		}

		// Parse the JSON array of colors
		err = json.Unmarshal([]byte(colorsJSON), &dailyPrompt.Colors)
		if err != nil {
			log.Printf("Error parsing colors JSON for day %s: %v", dailyPrompt.Day, err)
			continue
		}

		if createdByUserID.Valid {
			dailyPrompt.CreatedBy = &models.User{
				ID:         createdByUserID.String,
				Username:   createdByUsername.String,
				Email:      createdByUserEmail.String,
				CreatedAt:  createdByUserCreatedAt.Time,
				AvatarType: createdByAvatarType.String,
				AvatarURL:  createdByAvatarURL.String,
			}
		}

		prompts = append(prompts, dailyPrompt)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating future prompts: %w", err)
	}

	return prompts, nil
}

// CreateDailyPrompt creates a new daily prompt for a specific day
func CreateDailyPrompt(repo *sql.DB, ctx context.Context, day string, prompt string, colors []string) error {
	colorsJSON, err := json.Marshal(colors)
	if err != nil {
		return fmt.Errorf("error marshaling colors to JSON: %w", err)
	}

	query := `INSERT INTO daily_prompts (day, colors, prompt) VALUES (?, ?, ?)`
	_, err = repo.ExecContext(ctx, query, day, string(colorsJSON), prompt)
	if err != nil {
		return fmt.Errorf("error creating daily prompt for %s: %w", day, err)
	}

	return nil
}

// UpdateDailyPrompt updates an existing daily prompt for a specific day
func UpdateDailyPrompt(repo *sql.DB, ctx context.Context, day string, prompt string, colors []string) error {
	colorsJSON, err := json.Marshal(colors)
	if err != nil {
		return fmt.Errorf("error marshaling colors to JSON: %w", err)
	}

	query := `UPDATE daily_prompts SET colors = ?, prompt = ? WHERE day = ?`
	result, err := repo.ExecContext(ctx, query, string(colorsJSON), prompt, day)
	if err != nil {
		return fmt.Errorf("error updating daily prompt for %s: %w", day, err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}
