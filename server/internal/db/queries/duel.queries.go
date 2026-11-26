package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ---- Beta access ----

// HasBetaAccess reports whether the user may use the beta zone: admins always can,
// anyone else once an admin adds them.
func HasBetaAccess(repo *sql.DB, ctx context.Context, user models.User) (bool, error) {
	if user.Role == "admin" {
		return true, nil
	}
	var ok bool
	err := repo.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM beta_testers WHERE user_id = ?)`, user.ID).Scan(&ok)
	return ok, err
}

// BetaTester is someone let into the beta zone.
type BetaTester struct {
	User    models.User `json:"user"`
	IsAdmin bool        `json:"isAdmin"`
	// When they were added; nil for admins, who are always in
	AddedAt *time.Time `json:"addedAt"`
}

// ListBetaPlayers is everyone with beta access: admins and testers.
func ListBetaPlayers(repo *sql.DB, ctx context.Context) ([]BetaTester, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT u.id, u.username, u.created_at, u.avatar_type, u.avatar_url, u.decoration, u.color_hue,
			u.role = 'admin', bt.created_at
		FROM users u
		LEFT JOIN beta_testers bt ON bt.user_id = u.id
		WHERE u.role = 'admin' OR bt.user_id IS NOT NULL
		ORDER BY u.role = 'admin' DESC, bt.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	players := []BetaTester{}
	for rows.Next() {
		var p BetaTester
		var addedAt sql.NullTime
		if err := rows.Scan(&p.User.ID, &p.User.Username, &p.User.CreatedAt, &p.User.AvatarType, &p.User.AvatarURL, &p.User.Decoration, &p.IsAdmin, &addedAt); err != nil {
			return nil, err
		}
		if addedAt.Valid {
			p.AddedAt = &addedAt.Time
		}
		players = append(players, p)
	}
	return players, rows.Err()
}

func AddBetaTester(repo *sql.DB, ctx context.Context, userID, addedBy string) error {
	_, err := repo.ExecContext(ctx, `INSERT OR IGNORE INTO beta_testers (user_id, added_by) VALUES (?, ?)`, userID, addedBy)
	return err
}

func RemoveBetaTester(repo *sql.DB, ctx context.Context, userID string) error {
	_, err := repo.ExecContext(ctx, `DELETE FROM beta_testers WHERE user_id = ?`, userID)
	return err
}

// ---- Duels ----

// NewDuelRound is a round's prompt, picked when the duel starts.
type NewDuelRound struct {
	Prompt   string
	Keywords []string
}

// CreateDuel starts a duel. Round 1 is the challenger's to draw, round 2 the opponent's.
func CreateDuel(repo *sql.DB, ctx context.Context, challengerID, opponentID, hostID string, rounds [2]NewDuelRound) (string, error) {
	id := uuid.New().String()
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO duels (id, challenger_id, opponent_id, host_id) VALUES (?, ?, ?, ?)`,
		id, challengerID, opponentID, hostID); err != nil {
		return "", err
	}
	players := [2][2]string{{challengerID, opponentID}, {opponentID, challengerID}}
	for i, r := range rounds {
		keywords, _ := json.Marshal(r.Keywords)
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO duel_rounds (duel_id, round, drawer_id, guesser_id, prompt, keywords) VALUES (?, ?, ?, ?, ?, ?)`,
			id, i+1, players[i][0], players[i][1], r.Prompt, string(keywords)); err != nil {
			return "", err
		}
	}
	return id, tx.Commit()
}

const duelUserCols = `c.id, c.username, c.created_at, c.avatar_type, c.avatar_url, c.decoration, c.color_hue,
	o.id, o.username, o.created_at, o.avatar_type, o.avatar_url, o.decoration, o.color_hue`

const duelCols = `d.id, d.status, d.host_id, d.summary, d.reminded_at, d.challenger_seen_at, d.opponent_seen_at,
	d.created_at, d.updated_at, d.finished_at, ` + duelUserCols

const duelFrom = `FROM duels d
	JOIN users c ON c.id = d.challenger_id
	JOIN users o ON o.id = d.opponent_id`

type rowScanner interface{ Scan(dest ...any) error }

func scanDuel(row rowScanner) (models.Duel, error) {
	var d models.Duel
	var reminded, cSeen, oSeen, finished sql.NullTime
	err := row.Scan(&d.ID, &d.Status, &d.HostID, &d.Summary, &reminded, &cSeen, &oSeen,
		&d.CreatedAt, &d.UpdatedAt, &finished,
		&d.Challenger.ID, &d.Challenger.Username, &d.Challenger.CreatedAt, &d.Challenger.AvatarType, &d.Challenger.AvatarURL, &d.Challenger.Decoration, &d.Challenger.ColorHue,
		&d.Opponent.ID, &d.Opponent.Username, &d.Opponent.CreatedAt, &d.Opponent.AvatarType, &d.Opponent.AvatarURL, &d.Opponent.Decoration, &d.Opponent.ColorHue)
	d.RemindedAt = nullTime(reminded)
	d.ChallengerSeenAt = nullTime(cSeen)
	d.OpponentSeenAt = nullTime(oSeen)
	d.FinishedAt = nullTime(finished)
	return d, err
}

func nullTime(t sql.NullTime) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

// GetDuel loads a duel with its rounds, drawings and guesses.
func GetDuel(repo *sql.DB, ctx context.Context, id string) (models.Duel, error) {
	d, err := scanDuel(repo.QueryRowContext(ctx, `SELECT `+duelCols+` `+duelFrom+` WHERE d.id = ?`, id))
	if err != nil {
		return d, err
	}
	rounds, err := loadDuelRounds(repo, ctx, []string{id}, true)
	if err != nil {
		return d, err
	}
	d.Rounds = rounds[id]
	return d, nil
}

// ListDuels lists duels, newest first, with their rounds and guesses but no drawings.
// With a userID, just that player's.
func ListDuels(repo *sql.DB, ctx context.Context, userID string, limit int) ([]models.Duel, error) {
	query := `SELECT ` + duelCols + ` ` + duelFrom
	args := []any{}
	if userID != "" {
		query += ` WHERE d.challenger_id = ? OR d.opponent_id = ?`
		args = append(args, userID, userID)
	}
	query += ` ORDER BY d.updated_at DESC LIMIT ?`
	args = append(args, limit)
	return queryDuels(repo, ctx, query, args...)
}

func queryDuels(repo *sql.DB, ctx context.Context, query string, args ...any) ([]models.Duel, error) {
	rows, err := repo.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	duels := []models.Duel{}
	var ids []string
	for rows.Next() {
		d, err := scanDuel(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		duels = append(duels, d)
		ids = append(ids, d.ID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rounds, err := loadDuelRounds(repo, ctx, ids, false)
	if err != nil {
		return nil, err
	}
	for i := range duels {
		duels[i].Rounds = rounds[duels[i].ID]
	}
	return duels, nil
}

func loadDuelRounds(repo *sql.DB, ctx context.Context, ids []string, withImages bool) (map[string][]models.DuelRound, error) {
	out := map[string][]models.DuelRound{}
	if len(ids) == 0 {
		return out, nil
	}
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	imageCol := `''`
	if withImages {
		imageCol = `COALESCE(image, '')`
	}
	rows, err := repo.QueryContext(ctx, `
		SELECT duel_id, round, drawer_id, guesser_id, prompt, keywords, draw_started_at, `+imageCol+`, image IS NOT NULL,
			drawn_at, score, finished_at
		FROM duel_rounds WHERE duel_id IN (`+placeholders(len(ids))+`) ORDER BY duel_id, round`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var duelID, keywords string
		var r models.DuelRound
		var started, drawn, finished sql.NullTime
		var score sql.NullInt64
		if err := rows.Scan(&duelID, &r.Number, &r.DrawerID, &r.GuesserID, &r.Prompt, &keywords, &started, &r.Image, &r.HasImage,
			&drawn, &score, &finished); err != nil {
			rows.Close()
			return nil, err
		}
		_ = json.Unmarshal([]byte(keywords), &r.Keywords)
		r.DrawStartedAt = nullTime(started)
		r.DrawnAt = nullTime(drawn)
		r.FinishedAt = nullTime(finished)
		if score.Valid {
			s := int(score.Int64)
			r.Score = &s
		}
		out[duelID] = append(out[duelID], r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	grows, err := repo.QueryContext(ctx, `
		SELECT duel_id, round, attempt, guess, score, exact, feedback, note, created_at
		FROM duel_guesses WHERE duel_id IN (`+placeholders(len(ids))+`) ORDER BY duel_id, round, attempt`, args...)
	if err != nil {
		return nil, err
	}
	defer grows.Close()
	for grows.Next() {
		var duelID, feedback string
		var round int
		var g models.DuelGuess
		if err := grows.Scan(&duelID, &round, &g.Attempt, &g.Guess, &g.Score, &g.Exact, &feedback, &g.Note, &g.CreatedAt); err != nil {
			return nil, err
		}
		g.Feedback = json.RawMessage(feedback)
		rounds := out[duelID]
		for i := range rounds {
			if rounds[i].Number == round {
				rounds[i].Guesses = append(rounds[i].Guesses, g)
			}
		}
	}
	return out, grows.Err()
}

// UsedDuelPrompts is every prompt either player has had in a duel, so they get fresh ones.
func UsedDuelPrompts(repo *sql.DB, ctx context.Context, userA, userB string) ([]string, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT DISTINCT prompt FROM duel_rounds
		WHERE drawer_id IN (?, ?) OR guesser_id IN (?, ?)`, userA, userB, userA, userB)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var prompts []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		prompts = append(prompts, p)
	}
	return prompts, rows.Err()
}

// touchDuel marks the duel as having moved on, restarting the reminder clock.
func touchDuel(ctx context.Context, tx *sql.Tx, duelID string) error {
	_, err := tx.ExecContext(ctx, `UPDATE duels SET updated_at = CURRENT_TIMESTAMP, reminded_at = NULL WHERE id = ?`, duelID)
	return err
}

// StartDuelDrawing starts the drawer's minute, once. Returns false if it had already started.
func StartDuelDrawing(repo *sql.DB, ctx context.Context, duelID string, round int) (bool, error) {
	res, err := repo.ExecContext(ctx,
		`UPDATE duel_rounds SET draw_started_at = CURRENT_TIMESTAMP WHERE duel_id = ? AND round = ? AND draw_started_at IS NULL`,
		duelID, round)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// ErrAlreadyDone means the step was already taken, e.g. a drawing sent twice.
var ErrAlreadyDone = errors.New("already done")

// SaveDuelDrawing saves the round's drawing, once.
func SaveDuelDrawing(repo *sql.DB, ctx context.Context, duelID string, round int, image string) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, `
		UPDATE duel_rounds SET image = ?, drawn_at = CURRENT_TIMESTAMP,
			draw_started_at = COALESCE(draw_started_at, CURRENT_TIMESTAMP)
		WHERE duel_id = ? AND round = ? AND image IS NULL`, image, duelID, round)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return ErrAlreadyDone
	}
	if err := touchDuel(ctx, tx, duelID); err != nil {
		return err
	}
	return tx.Commit()
}

// AddDuelGuess saves a guess. finishRound also closes the round with its best score, and
// finishDuel marks the whole duel done.
func AddDuelGuess(repo *sql.DB, ctx context.Context, duelID string, round int, g models.DuelGuess, finishRound, finishDuel bool) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO duel_guesses (duel_id, round, attempt, guess, score, exact, feedback, note)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		duelID, round, g.Attempt, g.Guess, g.Score, g.Exact, string(g.Feedback), g.Note); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "PRIMARY KEY") {
			return ErrAlreadyDone
		}
		return err
	}
	if finishRound {
		if _, err := tx.ExecContext(ctx, `
			UPDATE duel_rounds SET finished_at = CURRENT_TIMESTAMP,
				score = (SELECT MAX(score) FROM duel_guesses WHERE duel_id = ? AND round = ?)
			WHERE duel_id = ? AND round = ?`, duelID, round, duelID, round); err != nil {
			return err
		}
	}
	if finishDuel {
		if _, err := tx.ExecContext(ctx,
			`UPDATE duels SET status = 'done', finished_at = CURRENT_TIMESTAMP WHERE id = ?`, duelID); err != nil {
			return err
		}
	}
	if err := touchDuel(ctx, tx, duelID); err != nil {
		return err
	}
	return tx.Commit()
}

// EndDuel stops an active duel early (expired or cancelled).
func EndDuel(repo *sql.DB, ctx context.Context, duelID, status string) (bool, error) {
	res, err := repo.ExecContext(ctx,
		`UPDATE duels SET status = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'`,
		status, duelID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

func SetDuelSummary(repo *sql.DB, ctx context.Context, duelID, summary string) error {
	_, err := repo.ExecContext(ctx, `UPDATE duels SET summary = ? WHERE id = ?`, summary, duelID)
	return err
}

// MarkDuelSeen records that the player is looking at the duel right now.
func MarkDuelSeen(repo *sql.DB, ctx context.Context, duelID, userID string) error {
	_, err := repo.ExecContext(ctx, `
		UPDATE duels SET
			challenger_seen_at = CASE WHEN challenger_id = ? THEN CURRENT_TIMESTAMP ELSE challenger_seen_at END,
			opponent_seen_at = CASE WHEN opponent_id = ? THEN CURRENT_TIMESTAMP ELSE opponent_seen_at END
		WHERE id = ?`, userID, userID, duelID)
	return err
}

// ClaimDuelReminder marks the duel as reminded, unless it was within the last `every`.
// Returns whether this call claimed it, so a reminder goes out once.
func ClaimDuelReminder(repo *sql.DB, ctx context.Context, duelID string, every time.Duration) (bool, error) {
	res, err := repo.ExecContext(ctx, `
		UPDATE duels SET reminded_at = CURRENT_TIMESTAMP
		WHERE id = ? AND status = 'active'
			AND (reminded_at IS NULL OR reminded_at <= datetime('now', ?))`,
		duelID, sqliteAgo(every))
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// ListStaleDuels is active duels that haven't moved on for at least `idle`.
func ListStaleDuels(repo *sql.DB, ctx context.Context, idle time.Duration) ([]models.Duel, error) {
	return queryDuels(repo, ctx, `SELECT `+duelCols+` `+duelFrom+`
		WHERE d.status = 'active' AND d.updated_at <= datetime('now', ?)`, sqliteAgo(idle))
}

// sqliteAgo is a datetime() modifier for that long ago, e.g. "-90 minutes".
func sqliteAgo(d time.Duration) string {
	return "-" + strconv.Itoa(int(d.Minutes())) + " minutes"
}
