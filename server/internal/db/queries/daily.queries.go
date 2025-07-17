package queries

import (
	"context"
	"crypto/sha1"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
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
