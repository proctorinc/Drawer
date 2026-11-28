package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// SettingRedosCountForStreaks is the app setting ("true" or anything else) that lets drawings
// made with a redo count toward streaks. Off unless an admin turns it on.
const SettingRedosCountForStreaks = "redos_count_for_streaks"

// streakDay is a SQL condition on a user_submissions row: whether it counts toward streaks.
// Redone days only do when admins have said so.
func streakDay() string {
	return `(redo = 0 OR EXISTS (SELECT 1 FROM app_settings WHERE key = '` +
		SettingRedosCountForStreaks + `' AND value = 'true'))`
}

// MaxRedoDays caps how many missed prompts a player is offered at once.
const MaxRedoDays = 60

// RedoGrant lets a player draw one prompt they missed: Day's, or any day since they joined
// when Day is nil.
type RedoGrant struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Day       *string   `json:"day"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"createdAt"`
	// Set once a drawing has used it
	UsedAt  *time.Time `json:"usedAt"`
	UsedDay *string    `json:"usedDay"`
}

// AdminRedoGrant is a grant with who it's for and who gave it.
type AdminRedoGrant struct {
	RedoGrant
	Username  string  `json:"username"`
	GrantedBy *string `json:"grantedBy"`
}

// CreateRedoGrant gives userID a redo: for day, or for any missed day when day is nil.
func CreateRedoGrant(repo *sql.DB, ctx context.Context, userID string, day *string, note, grantedBy string) (string, error) {
	id := uuid.New().String()
	_, err := repo.ExecContext(ctx,
		`INSERT INTO redo_grants (id, user_id, day, note, granted_by) VALUES (?, ?, ?, ?, ?)`,
		id, userID, day, note, grantedBy)
	if err != nil {
		return "", fmt.Errorf("error granting %s a redo: %w", userID, err)
	}
	return id, nil
}

// RevokeRedoGrant takes back an unused grant. False if there was no such unused grant.
func RevokeRedoGrant(repo *sql.DB, ctx context.Context, id string) (bool, error) {
	res, err := repo.ExecContext(ctx, `DELETE FROM redo_grants WHERE id = ? AND used_at IS NULL`, id)
	if err != nil {
		return false, fmt.Errorf("error revoking redo %s: %w", id, err)
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

const redoGrantColumns = `g.id, g.user_id, g.day, g.note, g.created_at, g.used_at, g.used_day`

func scanRedoGrant(scan func(...any) error, extra ...any) (RedoGrant, error) {
	var (
		g       RedoGrant
		day     sql.NullString
		usedAt  sql.NullTime
		usedDay sql.NullString
	)
	err := scan(append([]any{&g.ID, &g.UserID, &day, &g.Note, &g.CreatedAt, &usedAt, &usedDay}, extra...)...)
	if day.Valid {
		g.Day = &day.String
	}
	if usedAt.Valid {
		g.UsedAt = &usedAt.Time
	}
	if usedDay.Valid {
		g.UsedDay = &usedDay.String
	}
	return g, err
}

// ListRedoGrants returns the newest grants, for admins.
func ListRedoGrants(repo *sql.DB, ctx context.Context, limit int) ([]AdminRedoGrant, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT `+redoGrantColumns+`, u.username, gb.username
		FROM redo_grants g
		JOIN users u ON u.id = g.user_id
		LEFT JOIN users gb ON gb.id = g.granted_by
		ORDER BY g.used_at IS NOT NULL, datetime(g.created_at) DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("error listing redos: %w", err)
	}
	defer rows.Close()

	list := []AdminRedoGrant{}
	for rows.Next() {
		var (
			a         AdminRedoGrant
			grantedBy sql.NullString
		)
		a.RedoGrant, err = scanRedoGrant(rows.Scan, &a.Username, &grantedBy)
		if err != nil {
			return nil, fmt.Errorf("error scanning redo: %w", err)
		}
		if grantedBy.Valid {
			a.GrantedBy = &grantedBy.String
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

// UnusedRedoGrants returns userID's grants that are still to be used, oldest first.
func UnusedRedoGrants(repo *sql.DB, ctx context.Context, userID string) ([]RedoGrant, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT `+redoGrantColumns+` FROM redo_grants g
		WHERE g.user_id = ? AND g.used_at IS NULL
		ORDER BY datetime(g.created_at)`, userID)
	if err != nil {
		return nil, fmt.Errorf("error fetching %s's redos: %w", userID, err)
	}
	defer rows.Close()

	grants := []RedoGrant{}
	for rows.Next() {
		g, err := scanRedoGrant(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("error scanning redo: %w", err)
		}
		grants = append(grants, g)
	}
	return grants, rows.Err()
}

// FreeRedoDays are the days, First to Last inclusive, anyone can redo without spending a
// grant: a live event's countdown days. The zero value covers none.
type FreeRedoDays struct {
	First, Last string
}

// Covers reports whether day is one of them.
func (f FreeRedoDays) Covers(day string) bool {
	return f.First != "" && f.First <= day && day <= f.Last
}

// RedoableDays returns the days userID can redo right now, newest first, leaving out except
// (yesterday's prompt while it can still be finished late, which needs no redo).
func RedoableDays(repo *sql.DB, ctx context.Context, userID, today, except string, free FreeRedoDays) ([]string, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT dp.day FROM daily_prompts dp
		WHERE dp.day != ? AND `+redoableDay+`
		ORDER BY dp.day DESC
		LIMIT ?`, append(append([]any{except}, redoableDayArgs(userID, today, free)...), MaxRedoDays)...)
	if err != nil {
		return nil, fmt.Errorf("error finding %s's redoable days: %w", userID, err)
	}
	defer rows.Close()

	days := []string{}
	for rows.Next() {
		var day string
		if err := rows.Scan(&day); err != nil {
			return nil, err
		}
		days = append(days, day)
	}
	return days, rows.Err()
}

// redoableDay is a SQL condition on daily_prompts dp: a prompt before today that the user never
// drew, which is a free day or one of their unused grants covers (its own day, or any day since
// they joined). Its arguments are redoableDayArgs.
const redoableDay = `dp.day < ?
	AND NOT EXISTS (SELECT 1 FROM user_submissions s WHERE s.user_id = ? AND s.day = dp.day)
	AND (dp.day BETWEEN ? AND ? OR EXISTS (
		SELECT 1 FROM redo_grants g
		WHERE g.user_id = ? AND g.used_at IS NULL
			AND (g.day = dp.day OR (g.day IS NULL
				AND dp.day >= (SELECT date(created_at) FROM users WHERE id = ?)))
	))`

func redoableDayArgs(userID, today string, free FreeRedoDays) []any {
	return []any{today, userID, free.First, free.Last, userID, userID}
}

// ErrNoRedo means the player has no unused grant that covers the day, or the day can't be
// redone (it isn't past, has no prompt, or they already drew it).
var ErrNoRedo = errors.New("no redo for that day")

// InsertRedoSubmission records a drawing of a missed day. A free day costs nothing; any other
// uses up one of userID's grants, together with the drawing: a grant for that very day if they
// have one, else an any-day one. ErrNoRedo if none applies.
func InsertRedoSubmission(repo *sql.DB, ctx context.Context, userID, day, today string, free FreeRedoDays) (string, error) {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	var redoable bool
	err = tx.QueryRowContext(ctx, `
		SELECT EXISTS (SELECT 1 FROM daily_prompts dp WHERE dp.day = ? AND `+redoableDay+`)`,
		append([]any{day}, redoableDayArgs(userID, today, free)...)...).Scan(&redoable)
	if err != nil {
		return "", fmt.Errorf("error checking %s's redo for %s: %w", userID, day, err)
	}
	if !redoable {
		return "", ErrNoRedo
	}

	if !free.Covers(day) {
		if err := useRedoGrant(tx, ctx, userID, day); err != nil {
			return "", err
		}
	}

	id := uuid.New().String()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO user_submissions (id, user_id, day, redo) VALUES (?, ?, ?, 1)`, id, userID, day); err != nil {
		return "", fmt.Errorf("error recording %s's redo for %s: %w", userID, day, err)
	}
	return id, tx.Commit()
}

// useRedoGrant spends one of userID's grants on day: the particular day's first, so an any-day
// one stays free for another day. ErrNoRedo if none covers it.
func useRedoGrant(tx *sql.Tx, ctx context.Context, userID, day string) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE redo_grants SET used_at = CURRENT_TIMESTAMP, used_day = ?
		WHERE id = (
			SELECT id FROM redo_grants
			WHERE user_id = ? AND used_at IS NULL AND (day = ? OR day IS NULL)
			ORDER BY day IS NULL, datetime(created_at)
			LIMIT 1
		)`, day, userID, day)
	if err != nil {
		return fmt.Errorf("error using %s's redo: %w", userID, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNoRedo
	}
	return nil
}

// AttachSubmissionFlags marks the submissions that were pinned late or drawn with a redo.
func AttachSubmissionFlags(repo *sql.DB, ctx context.Context, submissions []*models.UserPromptSubmission) error {
	if len(submissions) == 0 {
		return nil
	}
	ids := make([]any, 0, len(submissions))
	for _, s := range submissions {
		ids = append(ids, s.ID)
	}
	rows, err := repo.QueryContext(ctx,
		`SELECT id, late, redo FROM user_submissions WHERE (late = 1 OR redo = 1) AND id IN (`+placeholders(len(ids))+`)`,
		ids...)
	if err != nil {
		return fmt.Errorf("error fetching submission flags: %w", err)
	}
	defer rows.Close()

	type flags struct{ late, redo bool }
	found := map[string]flags{}
	for rows.Next() {
		var (
			id string
			f  flags
		)
		if err := rows.Scan(&id, &f.late, &f.redo); err != nil {
			return fmt.Errorf("error scanning submission flags: %w", err)
		}
		found[id] = f
	}
	for _, s := range submissions {
		s.Late, s.Redo = found[s.ID].late, found[s.ID].redo
	}
	return rows.Err()
}

// PlayerDay is one past prompt and what a player did with it, for admins deciding on redos.
type PlayerDay struct {
	Day    string   `json:"day"`
	Prompt string   `json:"prompt"`
	Colors []string `json:"colors"`
	// "drawn", "late" (finished after rollover), "redo" (drawn with a redo) or "missed"
	Status string `json:"status"`
}

// PlayerDays returns the prompts before today since userID joined, newest first, each with
// whether and how they drew it.
func PlayerDays(repo *sql.DB, ctx context.Context, userID, today string, limit int) ([]PlayerDay, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT dp.day, dp.prompt, dp.colors,
			CASE WHEN s.id IS NULL THEN 'missed'
				WHEN s.redo = 1 THEN 'redo'
				WHEN s.late = 1 THEN 'late'
				ELSE 'drawn' END
		FROM daily_prompts dp
		LEFT JOIN user_submissions s ON s.user_id = ? AND s.day = dp.day
		WHERE dp.day < ? AND dp.day >= (SELECT date(created_at) FROM users WHERE id = ?)
		ORDER BY dp.day DESC
		LIMIT ?`, userID, today, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("error listing %s's days: %w", userID, err)
	}
	defer rows.Close()

	days := []PlayerDay{}
	for rows.Next() {
		var (
			d      PlayerDay
			colors string
		)
		if err := rows.Scan(&d.Day, &d.Prompt, &colors, &d.Status); err != nil {
			return nil, fmt.Errorf("error scanning %s's days: %w", userID, err)
		}
		if err := json.Unmarshal([]byte(colors), &d.Colors); err != nil {
			return nil, fmt.Errorf("error reading %s's colors: %w", d.Day, err)
		}
		days = append(days, d)
	}
	return days, rows.Err()
}
