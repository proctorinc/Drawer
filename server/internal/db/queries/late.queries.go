package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/utils"
	"fmt"
	"time"
)

// RecordDrawingStart notes that the user has started drawing day's prompt. Starting again
// (another stroke, a reload, another device) keeps the first start.
func RecordDrawingStart(repo *sql.DB, ctx context.Context, userID, day string) error {
	_, err := repo.ExecContext(ctx,
		`INSERT OR IGNORE INTO drawing_starts (user_id, day) VALUES (?, ?)`, userID, day)
	if err != nil {
		return fmt.Errorf("error recording drawing start for %s on %s: %w", userID, day, err)
	}
	return nil
}

// CheckUserSubmittedOn reports whether the user has pinned a drawing for day.
func CheckUserSubmittedOn(repo *sql.DB, ctx context.Context, userID, day string) (bool, error) {
	var submitted bool
	err := repo.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM user_submissions WHERE user_id = ? AND day = ?)`,
		userID, day).Scan(&submitted)
	return submitted, err
}

// LateDay is the day whose prompt the user can still finish after it rolled over: yesterday,
// if they started it while it was live and haven't pinned it. "" when there's nothing to finish.
// The grace lasts until today's prompt rolls over too.
func LateDay(repo *sql.DB, ctx context.Context, userID string, now time.Time) (string, error) {
	yesterday := utils.GetFormattedDate(now.AddDate(0, 0, -1))
	var finishable bool
	err := repo.QueryRowContext(ctx, `
		SELECT EXISTS(SELECT 1 FROM drawing_starts WHERE user_id = ? AND day = ?)
			AND NOT EXISTS(SELECT 1 FROM user_submissions WHERE user_id = ? AND day = ?)`,
		userID, yesterday, userID, yesterday).Scan(&finishable)
	if err != nil {
		return "", fmt.Errorf("error checking %s's unfinished drawing: %w", userID, err)
	}
	if !finishable {
		return "", nil
	}
	return yesterday, nil
}
