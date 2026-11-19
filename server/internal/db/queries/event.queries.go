package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Timestamps are stored as UTC RFC3339 text, so string comparison is chronological.
const eventColumns = `id, slug, name, theme, starts_at, ends_at, countdown_days`

type eventRowScanner interface {
	Scan(dest ...any) error
}

func scanEvent(row eventRowScanner) (models.Event, error) {
	var (
		event         models.Event
		startsAt      string
		endsAt        string
		countdownDays sql.NullInt64
	)

	err := row.Scan(&event.ID, &event.Slug, &event.Name, &event.Theme, &startsAt, &endsAt, &countdownDays)
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

// getEvent returns the single event matched by `where`, with its reactions, or sql.ErrNoRows.
func getEvent(repo *sql.DB, ctx context.Context, where string, args ...any) (models.Event, error) {
	event, err := scanEvent(repo.QueryRowContext(ctx, `SELECT `+eventColumns+` FROM events `+where, args...))
	if err != nil {
		return models.Event{}, err
	}
	if event.Reactions, err = getEventReactions(repo, ctx, event.ID); err != nil {
		return models.Event{}, err
	}
	return event, nil
}

// GetActiveEvent returns the event active at `now`, or sql.ErrNoRows if there is none.
// If events overlap, the one that started most recently wins.
func GetActiveEvent(repo *sql.DB, ctx context.Context, now time.Time) (models.Event, error) {
	nowStr := formatEventTime(now)
	return getEvent(repo, ctx, `WHERE starts_at <= ? AND ends_at > ? ORDER BY starts_at DESC LIMIT 1`, nowStr, nowStr)
}

// GetNextEvent returns the soonest event that hasn't started at `now`, or sql.ErrNoRows.
func GetNextEvent(repo *sql.DB, ctx context.Context, now time.Time) (models.Event, error) {
	return getEvent(repo, ctx, `WHERE starts_at > ? ORDER BY starts_at ASC LIMIT 1`, formatEventTime(now))
}

// GetEventBySlug returns the event with this slug, or sql.ErrNoRows.
func GetEventBySlug(repo *sql.DB, ctx context.Context, slug string) (models.Event, error) {
	return getEvent(repo, ctx, `WHERE slug = ?`, slug)
}

// ListEvents returns every event with its reactions, newest first.
func ListEvents(repo *sql.DB, ctx context.Context) ([]models.Event, error) {
	rows, err := repo.QueryContext(ctx, `SELECT `+eventColumns+` FROM events ORDER BY starts_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []models.Event{}
	for rows.Next() {
		event, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	for i := range events {
		if events[i].Reactions, err = getEventReactions(repo, ctx, events[i].ID); err != nil {
			return nil, err
		}
	}
	return events, nil
}

func getEventReactions(repo *sql.DB, ctx context.Context, eventID string) ([]string, error) {
	rows, err := repo.QueryContext(ctx,
		`SELECT reaction_id FROM event_reactions WHERE event_id = ? ORDER BY rowid`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reactions := []string{}
	for rows.Next() {
		var reaction string
		if err := rows.Scan(&reaction); err != nil {
			return nil, err
		}
		reactions = append(reactions, reaction)
	}
	return reactions, rows.Err()
}

// IsEventSlugTaken reports whether another event (not exceptID) already uses this slug.
func IsEventSlugTaken(repo *sql.DB, ctx context.Context, slug, exceptID string) (bool, error) {
	var taken bool
	err := repo.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM events WHERE slug = ? AND id != ?)`, slug, exceptID).Scan(&taken)
	return taken, err
}

// CreateEvent inserts the event and its reactions, returning it with its new ID.
func CreateEvent(repo *sql.DB, ctx context.Context, event models.Event) (models.Event, error) {
	event.ID = uuid.New().String()
	err := withEventTx(repo, ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO events (id, slug, name, theme, starts_at, ends_at, countdown_days) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			event.ID, event.Slug, event.Name, event.Theme,
			formatEventTime(event.StartsAt), formatEventTime(event.EndsAt), event.CountdownDays)
		if err != nil {
			return err
		}
		return replaceEventReactions(tx, ctx, event.ID, event.Reactions)
	})
	return event, err
}

// UpdateEvent overwrites the event with event.ID and replaces its reactions.
// It returns sql.ErrNoRows if there is no such event.
func UpdateEvent(repo *sql.DB, ctx context.Context, event models.Event) error {
	return withEventTx(repo, ctx, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx,
			`UPDATE events SET slug = ?, name = ?, theme = ?, starts_at = ?, ends_at = ?, countdown_days = ? WHERE id = ?`,
			event.Slug, event.Name, event.Theme,
			formatEventTime(event.StartsAt), formatEventTime(event.EndsAt), event.CountdownDays, event.ID)
		if err != nil {
			return err
		}
		if updated, err := result.RowsAffected(); err != nil {
			return err
		} else if updated == 0 {
			return sql.ErrNoRows
		}
		return replaceEventReactions(tx, ctx, event.ID, event.Reactions)
	})
}

func replaceEventReactions(tx *sql.Tx, ctx context.Context, eventID string, reactions []string) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM event_reactions WHERE event_id = ?`, eventID); err != nil {
		return err
	}
	for _, reaction := range reactions {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO event_reactions (event_id, reaction_id) VALUES (?, ?)`, eventID, reaction)
		if err != nil {
			return err
		}
	}
	return nil
}

// IsEventReactionAllowed reports whether an event active at `now` allows this reaction id.
func IsEventReactionAllowed(repo *sql.DB, ctx context.Context, reactionID string, now time.Time) (bool, error) {
	nowStr := formatEventTime(now)
	var allowed bool
	err := repo.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM event_reactions er
			JOIN events e ON e.id = er.event_id
			WHERE er.reaction_id = ? AND e.starts_at <= ? AND e.ends_at > ?
		)`, reactionID, nowStr, nowStr).Scan(&allowed)
	return allowed, err
}

func formatEventTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func withEventTx(repo *sql.DB, ctx context.Context, fn func(tx *sql.Tx) error) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}
