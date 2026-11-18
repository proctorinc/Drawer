package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"fmt"
	"time"
)

// GetActiveEvent returns the event active at `now`, or sql.ErrNoRows if there is none.
// If events overlap, the one that started most recently wins.
func GetActiveEvent(repo *sql.DB, ctx context.Context, now time.Time) (models.Event, error) {
	// Timestamps are stored as UTC RFC3339 text, so string comparison is chronological.
	query := `SELECT id, slug, name, theme, starts_at, ends_at, countdown_days
		FROM events
		WHERE starts_at <= ? AND ends_at > ?
		ORDER BY starts_at DESC
		LIMIT 1`
	nowStr := now.UTC().Format(time.RFC3339)

	var (
		event         models.Event
		startsAt      string
		endsAt        string
		countdownDays sql.NullInt64
	)

	err := repo.QueryRowContext(ctx, query, nowStr, nowStr).Scan(
		&event.ID, &event.Slug, &event.Name, &event.Theme, &startsAt, &endsAt, &countdownDays)
	if err != nil {
		return models.Event{}, err
	}

	if event.StartsAt, err = time.Parse(time.RFC3339, startsAt); err != nil {
		return models.Event{}, fmt.Errorf("error parsing starts_at for event %s: %w", event.Slug, err)
	}
	if event.EndsAt, err = time.Parse(time.RFC3339, endsAt); err != nil {
		return models.Event{}, fmt.Errorf("error parsing ends_at for event %s: %w", event.Slug, err)
	}
	if countdownDays.Valid {
		days := int(countdownDays.Int64)
		event.CountdownDays = &days
	}

	return event, nil
}
