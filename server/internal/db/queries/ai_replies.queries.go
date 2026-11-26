package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"fmt"

	"github.com/google/uuid"
)

// AddAIReplies posts a judge's replies in a doodle's comments, in order.
func AddAIReplies(repo *sql.DB, ctx context.Context, submissionID string, judge models.AIPersonality, texts []string) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("error posting AI replies: %w", err)
	}
	defer tx.Rollback()
	for _, text := range texts {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO ai_replies (id, submission_id, personality_id, text) VALUES (?, ?, ?, ?)`,
			uuid.New().String(), submissionID, judge.ID, text,
		); err != nil {
			return fmt.Errorf("error posting AI reply: %w", err)
		}
	}
	return tx.Commit()
}

// GetAIReplies returns the judges' replies on a doodle, oldest first.
func GetAIReplies(repo *sql.DB, ctx context.Context, submissionID string) ([]models.AIReply, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT r.id, r.text, r.created_at, p.id, p.name, p.bio, p.avatar_url, p.decoration, p.scores_backwards
		FROM ai_replies r JOIN ai_personalities p ON p.id = r.personality_id
		WHERE r.submission_id = ?
		ORDER BY datetime(r.created_at), r.rowid`, submissionID)
	if err != nil {
		return nil, fmt.Errorf("error fetching AI replies: %w", err)
	}
	defer rows.Close()

	replies := []models.AIReply{}
	for rows.Next() {
		var r models.AIReply
		if err := rows.Scan(&r.ID, &r.Text, &r.CreatedAt,
			&r.Judge.ID, &r.Judge.Name, &r.Judge.Bio, &r.Judge.AvatarURL, &r.Judge.Decoration, &r.Judge.ScoresBackwards); err != nil {
			return nil, fmt.Errorf("error scanning AI reply: %w", err)
		}
		replies = append(replies, r)
	}
	return replies, rows.Err()
}

// DeleteAIReply removes a judge's reply. Returns sql.ErrNoRows when there's no such reply.
func DeleteAIReply(repo *sql.DB, ctx context.Context, id string) error {
	res, err := repo.ExecContext(ctx, `DELETE FROM ai_replies WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("error deleting AI reply: %w", err)
	}
	if n, err := res.RowsAffected(); err == nil && n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ThreadMessage is one thing said under a doodle: a player's comment or a judge's reply.
type ThreadMessage struct {
	Author string // A username, or the judge's name
	Artist bool   // Said by the doodle's artist
	Judge  bool   // Said by an AI judge
	Text   string
}

// GetCommentThread returns everything said under a doodle, players' comments
// and judges' replies together, oldest first.
func GetCommentThread(repo *sql.DB, ctx context.Context, submissionID string) ([]ThreadMessage, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT author, artist, judge, text FROM (
			SELECT u.username AS author, c.user_id = s.user_id AS artist, 0 AS judge, c.text, c.created_at
			FROM comments c
			JOIN users u ON u.id = c.user_id
			JOIN user_submissions s ON s.id = c.submission_id
			WHERE c.submission_id = ?
			UNION ALL
			SELECT p.name, 0, 1, r.text, r.created_at
			FROM ai_replies r JOIN ai_personalities p ON p.id = r.personality_id
			WHERE r.submission_id = ?
		)
		ORDER BY datetime(created_at)`, submissionID, submissionID)
	if err != nil {
		return nil, fmt.Errorf("error fetching comment thread: %w", err)
	}
	defer rows.Close()

	thread := []ThreadMessage{}
	for rows.Next() {
		var m ThreadMessage
		if err := rows.Scan(&m.Author, &m.Artist, &m.Judge, &m.Text); err != nil {
			return nil, fmt.Errorf("error scanning comment thread: %w", err)
		}
		thread = append(thread, m)
	}
	return thread, rows.Err()
}

// autoReplyTimeout is how long a claimed automatic reply counts as being written. A claim
// older than that was lost (the server restarted mid-call) and stops showing as pending.
const autoReplyTimeout = "-2 minutes"

// ClaimAutoReply takes a doodle's one automatic judge reply, or a lost claim on it. It reports
// false when the doodle has had it already, or another comment is getting it now.
func ClaimAutoReply(repo *sql.DB, ctx context.Context, submissionID string) (bool, error) {
	res, err := repo.ExecContext(ctx, `
		INSERT INTO ai_auto_replies (submission_id) VALUES (?)
		ON CONFLICT (submission_id) DO UPDATE SET started_at = CURRENT_TIMESTAMP
		WHERE replied_at IS NULL AND datetime(started_at) <= datetime('now', '`+autoReplyTimeout+`')`, submissionID)
	if err != nil {
		return false, fmt.Errorf("error claiming automatic AI reply: %w", err)
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// PostAutoReply posts a doodle's automatic judge reply and marks its claim done.
func PostAutoReply(repo *sql.DB, ctx context.Context, submissionID string, judge models.AIPersonality, text string) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("error posting automatic AI reply: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO ai_replies (id, submission_id, personality_id, text) VALUES (?, ?, ?, ?)`,
		uuid.New().String(), submissionID, judge.ID, text,
	); err != nil {
		return fmt.Errorf("error posting automatic AI reply: %w", err)
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE ai_auto_replies SET replied_at = CURRENT_TIMESTAMP WHERE submission_id = ?`, submissionID,
	); err != nil {
		return fmt.Errorf("error marking automatic AI reply done: %w", err)
	}
	return tx.Commit()
}

// ReleaseAutoReply gives a doodle's automatic reply back after the judge failed to write it,
// so the next @mention can have it.
func ReleaseAutoReply(repo *sql.DB, ctx context.Context, submissionID string) error {
	if _, err := repo.ExecContext(ctx,
		`DELETE FROM ai_auto_replies WHERE submission_id = ? AND replied_at IS NULL`, submissionID,
	); err != nil {
		return fmt.Errorf("error releasing automatic AI reply: %w", err)
	}
	return nil
}

// AutoReplyPending reports whether the judge is writing a doodle's automatic reply right now.
func AutoReplyPending(repo *sql.DB, ctx context.Context, submissionID string) (bool, error) {
	var pending bool
	err := repo.QueryRowContext(ctx, `
		SELECT EXISTS (SELECT 1 FROM ai_auto_replies
			WHERE submission_id = ? AND replied_at IS NULL
				AND datetime(started_at) > datetime('now', '`+autoReplyTimeout+`'))`, submissionID).Scan(&pending)
	if err != nil {
		return false, fmt.Errorf("error checking for a pending AI reply: %w", err)
	}
	return pending, nil
}
