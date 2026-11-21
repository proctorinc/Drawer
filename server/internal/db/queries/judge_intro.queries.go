package queries

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

// GetJudgeIntro returns the stored intro for a judge's day, written from sourceHash.
// Found is false when there isn't one yet.
func GetJudgeIntro(repo *sql.DB, ctx context.Context, day, personalityID, sourceHash string) (lines []string, found bool, err error) {
	var raw string
	err = repo.QueryRowContext(ctx, `SELECT lines FROM judge_intros WHERE day = ? AND personality_id = ? AND source_hash = ?`,
		day, personalityID, sourceHash).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("error fetching judge intro: %w", err)
	}
	if err := json.Unmarshal([]byte(raw), &lines); err != nil {
		return nil, false, fmt.Errorf("error reading judge intro: %w", err)
	}
	return lines, true, nil
}

// SaveJudgeIntro stores an intro unless one is already there, and returns whichever is
// stored: when two servers write at once, the first one wins and both use it.
func SaveJudgeIntro(repo *sql.DB, ctx context.Context, day, personalityID, sourceHash string, lines []string) ([]string, error) {
	raw, err := json.Marshal(lines)
	if err != nil {
		return nil, err
	}
	if _, err := repo.ExecContext(ctx, `INSERT OR IGNORE INTO judge_intros (day, personality_id, source_hash, lines) VALUES (?, ?, ?, ?)`,
		day, personalityID, sourceHash, string(raw)); err != nil {
		return nil, fmt.Errorf("error saving judge intro: %w", err)
	}
	stored, found, err := GetJudgeIntro(repo, ctx, day, personalityID, sourceHash)
	if err != nil {
		return nil, err
	}
	if !found {
		return lines, nil
	}
	return stored, nil
}
