package queries

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// ErrPledgeAfterDrawing is returned when a player tries to pick a side after drawing the day's
// doodle: the judge has already seen which side they drew for.
var ErrPledgeAfterDrawing = errors.New("already drew today's doodle")

// SaveJudgePledge records whose side the player took when a judge that scores backwards asked
// them to help ruin day, replacing an earlier answer that day. eventID is "" outside an event.
// Once they've drawn the day's doodle, their answer is locked (ErrPledgeAfterDrawing).
func SaveJudgePledge(repo *sql.DB, ctx context.Context, userID, day, personalityID, eventID string, joined bool) error {
	drawn, err := HasDrawnDay(repo, ctx, userID, day)
	if err != nil {
		return err
	}
	if drawn {
		return ErrPledgeAfterDrawing
	}
	_, err = repo.ExecContext(ctx, `
		INSERT INTO judge_pledges (user_id, day, personality_id, event_id, joined)
		VALUES (?, ?, ?, NULLIF(?, ''), ?)
		ON CONFLICT (user_id, day) DO UPDATE SET
			personality_id = excluded.personality_id, event_id = excluded.event_id,
			joined = excluded.joined, updated_at = CURRENT_TIMESTAMP`,
		userID, day, personalityID, eventID, joined)
	if err != nil {
		return fmt.Errorf("error saving judge pledge: %w", err)
	}
	return nil
}

// HasDrawnDay reports whether the player has drawn day's doodle.
func HasDrawnDay(repo *sql.DB, ctx context.Context, userID, day string) (bool, error) {
	var drawn bool
	err := repo.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM user_submissions WHERE user_id = ? AND day = ?)`, userID, day).Scan(&drawn)
	if err != nil {
		return false, fmt.Errorf("error checking for the day's doodle: %w", err)
	}
	return drawn, nil
}

// GetJudgePledge returns whose side the player took on day: joined (true), refused (false), or
// nil when they never answered.
func GetJudgePledge(repo *sql.DB, ctx context.Context, userID, day string) (*bool, error) {
	var joined bool
	err := repo.QueryRowContext(ctx, `SELECT joined FROM judge_pledges WHERE user_id = ? AND day = ?`, userID, day).Scan(&joined)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("error loading judge pledge: %w", err)
	}
	return &joined, nil
}

// GetLastJudgePledge is the player's most recent answer to a judge that scores backwards before
// day (joined true or false; nil if they never answered one), and that judge's score for what
// they drew that day (nil if they didn't draw, or it wasn't judged).
func GetLastJudgePledge(repo *sql.DB, ctx context.Context, userID, day string) (joined *bool, score *float64, err error) {
	var (
		lastDay string
		j       bool
		s       sql.NullFloat64
	)
	err = repo.QueryRowContext(ctx, `
		SELECT jp.day, jp.joined, (
			SELECT r.score FROM user_submissions sub
			JOIN ai_reviews r ON r.submission_id = sub.id AND r.status = 'done'
			JOIN ai_personalities p ON p.id = r.personality_id AND p.scores_backwards = 1
			WHERE sub.user_id = jp.user_id AND sub.day = jp.day
		)
		FROM judge_pledges jp
		WHERE jp.user_id = ? AND jp.day < ?
		ORDER BY jp.day DESC LIMIT 1`, userID, day).Scan(&lastDay, &j, &s)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("error loading last judge pledge: %w", err)
	}
	joined = &j
	if s.Valid {
		score = &s.Float64
	}
	return joined, score, nil
}
