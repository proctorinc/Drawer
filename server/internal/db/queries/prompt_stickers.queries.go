package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"fmt"
)

// PromptSticker is the sticker one day's prompt hands out
type PromptSticker struct {
	Day string `json:"day"`
	models.Sticker
}

// ListPromptStickers returns every prompt's sticker, newest day first
func ListPromptStickers(repo *sql.DB, ctx context.Context) ([]PromptSticker, error) {
	rows, err := repo.QueryContext(ctx, `SELECT day, kind, size, max_chars FROM prompt_stickers ORDER BY day DESC`)
	if err != nil {
		return nil, fmt.Errorf("listing prompt stickers: %w", err)
	}
	defer rows.Close()

	stickers := []PromptSticker{}
	for rows.Next() {
		var s PromptSticker
		if err := rows.Scan(&s.Day, &s.Kind, &s.Size, &s.MaxChars); err != nil {
			return nil, fmt.Errorf("scanning prompt sticker: %w", err)
		}
		stickers = append(stickers, s)
	}
	return stickers, rows.Err()
}

// SetPromptSticker gives day's prompt its sticker, in place of any it had. It returns
// sql.ErrNoRows if there's no prompt that day.
func SetPromptSticker(repo *sql.DB, ctx context.Context, day string, sticker models.Sticker) error {
	result, err := repo.ExecContext(ctx, `
		INSERT INTO prompt_stickers (day, kind, size, max_chars)
		SELECT day, ?, ?, ? FROM daily_prompts WHERE day = ?
		ON CONFLICT (day) DO UPDATE SET
			kind = excluded.kind, size = excluded.size, max_chars = excluded.max_chars, updated_at = CURRENT_TIMESTAMP`,
		sticker.Kind, sticker.Size, sticker.MaxChars, day)
	if err != nil {
		return fmt.Errorf("setting the sticker for %s: %w", day, err)
	}
	if n, err := result.RowsAffected(); err == nil && n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// RemovePromptSticker takes day's sticker away, if it had one
func RemovePromptSticker(repo *sql.DB, ctx context.Context, day string) error {
	if _, err := repo.ExecContext(ctx, `DELETE FROM prompt_stickers WHERE day = ?`, day); err != nil {
		return fmt.Errorf("removing the sticker for %s: %w", day, err)
	}
	return nil
}
