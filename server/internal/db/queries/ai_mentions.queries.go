package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/utils"
	"fmt"
	"regexp"
	"strings"
)

// AIMention is a player's comment that @mentions the AI judge who reviewed the doodle. It's
// answered once that judge replies on the doodle after it, or done once an admin checks it off
// by hand. Mentions of any other judge are left out: only the reviewer answers on a doodle.
type AIMention struct {
	CommentID    int64   `json:"commentId"`
	SubmissionID string  `json:"submissionId"`
	ImageURL     string  `json:"imageUrl"`
	Prompt       string  `json:"prompt"`
	Username     string  `json:"username"`
	Text         string  `json:"text"`
	CreatedAt    string  `json:"createdAt"`
	Judge        string  `json:"judge"`     // The judge who reviewed the doodle
	RepliedBy    *string `json:"repliedBy"` // That judge, once they've replied after it
	RepliedAt    *string `json:"repliedAt"`
	CheckedBy    *string `json:"checkedBy"` // The admin who checked it off, if they're still around
	CheckedAt    *string `json:"checkedAt"`
}

// mentionPattern finds @mentions the way the app does (splitMentions in src/mentions/mentions.ts):
// an @ that starts a word, running to the next space, without trailing punctuation.
var (
	mentionPattern  = regexp.MustCompile(`(?:^|\s)@([^\s@]+)`)
	mentionTrailing = regexp.MustCompile(`[.,!?;:)\]'"]+$`)
)

// MentionsJudge reports whether text @mentions the judge named name, by its handle (its name
// without spaces, as judgeHandle in src/mentions/mentions.ts), in any case.
func MentionsJudge(text, name string) bool {
	handle := strings.Join(strings.Fields(name), "")
	for _, m := range mentionPattern.FindAllStringSubmatch(text, -1) {
		if strings.EqualFold(mentionTrailing.ReplaceAllString(m[1], ""), handle) {
			return true
		}
	}
	return false
}

// ListAIMentions returns every comment that @mentions the judge who reviewed its doodle,
// oldest first.
func ListAIMentions(repo *sql.DB, ctx context.Context, cfg *config.Config) ([]AIMention, error) {
	// Only comments with an @ can mention anyone; whether it's the reviewer is checked below
	rows, err := repo.QueryContext(ctx, `
		SELECT c.id, c.submission_id, s.user_id, COALESCE(dp.prompt, ''), u.username, c.text,
			`+isoTime("c.created_at")+`, j.name, `+isoTime("r.created_at")+`, ku.username, `+isoTime("k.checked_at")+`
		FROM comments c
		JOIN users u ON u.id = c.user_id
		JOIN user_submissions s ON s.id = c.submission_id
		JOIN ai_reviews rv ON rv.submission_id = c.submission_id
		JOIN ai_personalities j ON j.id = rv.personality_id
		LEFT JOIN daily_prompts dp ON dp.day = s.day
		LEFT JOIN ai_replies r ON r.id = (
			SELECT id FROM ai_replies
			WHERE submission_id = c.submission_id AND personality_id = rv.personality_id
				AND datetime(created_at) > datetime(c.created_at)
			ORDER BY datetime(created_at), rowid LIMIT 1)
		LEFT JOIN ai_mention_checks k ON k.comment_id = c.id
		LEFT JOIN users ku ON ku.id = k.checked_by
		WHERE c.text LIKE '%@%'
		ORDER BY datetime(c.created_at), c.id`)
	if err != nil {
		return nil, fmt.Errorf("error listing AI mentions: %w", err)
	}
	defer rows.Close()

	mentions := []AIMention{}
	for rows.Next() {
		var (
			m                               AIMention
			artistID                        string
			repliedAt, checkedBy, checkedAt sql.NullString
		)
		if err := rows.Scan(&m.CommentID, &m.SubmissionID, &artistID, &m.Prompt, &m.Username, &m.Text,
			&m.CreatedAt, &m.Judge, &repliedAt, &checkedBy, &checkedAt); err != nil {
			return nil, fmt.Errorf("error scanning AI mention: %w", err)
		}
		if !MentionsJudge(m.Text, m.Judge) {
			continue
		}
		m.ImageURL = utils.GetImageUrl(cfg, utils.GetSubmissionFilename(artistID, m.SubmissionID))
		if m.RepliedAt = nullable(repliedAt); m.RepliedAt != nil {
			m.RepliedBy = &m.Judge
		}
		m.CheckedBy, m.CheckedAt = nullable(checkedBy), nullable(checkedAt)
		mentions = append(mentions, m)
	}
	return mentions, rows.Err()
}

func nullable(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	return &s.String
}

// CheckAIMention marks a comment's @mention dealt with by an admin.
// Returns sql.ErrNoRows when there's no such comment.
func CheckAIMention(repo *sql.DB, ctx context.Context, commentID int64, adminID string) error {
	var exists int
	if err := repo.QueryRowContext(ctx, `SELECT 1 FROM comments WHERE id = ?`, commentID).Scan(&exists); err != nil {
		return err
	}
	if _, err := repo.ExecContext(ctx, `
		INSERT INTO ai_mention_checks (comment_id, checked_by) VALUES (?, ?)
		ON CONFLICT (comment_id) DO NOTHING`, commentID, adminID); err != nil {
		return fmt.Errorf("error checking off AI mention: %w", err)
	}
	return nil
}

// UncheckAIMention takes an admin's check-off back.
func UncheckAIMention(repo *sql.DB, ctx context.Context, commentID int64) error {
	if _, err := repo.ExecContext(ctx, `DELETE FROM ai_mention_checks WHERE comment_id = ?`, commentID); err != nil {
		return fmt.Errorf("error unchecking AI mention: %w", err)
	}
	return nil
}
