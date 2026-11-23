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

// AIRunKind is why a judge was asked about a doodle.
type AIRunKind string

const (
	AIRunSubmission AIRunKind = "submission" // A player drew it; the review is shown to players
	AIRunRerun      AIRunKind = "rerun"      // An admin re-judged a doodle; players see it only once applied
	AIRunTest       AIRunKind = "test"       // The admin testing ground; players see it only once applied
)

// AIRun is one call to a judge, as the admin AI log shows it.
type AIRun struct {
	ID              string                    `json:"id"`
	Kind            AIRunKind                 `json:"kind"`
	BatchID         string                    `json:"batchId"` // Shared by judges run together in the testing ground
	PersonalityID   string                    `json:"personalityId"`
	JudgeName       string                    `json:"judgeName"`
	JudgeAvatarURL  string                    `json:"judgeAvatarUrl"`
	JudgeDecoration string                    `json:"judgeDecoration"`
	SystemPrompt    string                    `json:"systemPrompt"` // The personality prompt as it ran
	SubmissionID    *string                   `json:"submissionId"` // Unset for a custom testing-ground drawing
	Prompt          string                    `json:"prompt"`
	ImageData       string                    `json:"-"`        // A custom drawing, as a data: URL
	ImageURL        string                    `json:"imageUrl"` // Filled in by the handler
	User            *models.User              `json:"user"`     // The artist for a real doodle, else the admin who ran it
	Status          string                    `json:"status"`   // done or failed
	Score           *float64                  `json:"score"`
	Criteria        []models.AICriterionScore `json:"criteria"`
	Comment         string                    `json:"comment"`
	Model           string                    `json:"model"`
	Error           string                    `json:"error"`
	DurationMS      int64                     `json:"durationMs"`
	Metadata        AIRunMetadata             `json:"metadata"`
	CreatedAt       time.Time                 `json:"createdAt"`
	// When it was made its doodle's review: straight away for a real doodle, by an admin for
	// a re-run or test. Unset when it never was.
	AppliedAt *time.Time `json:"appliedAt"`
	// Whether it's the review players see on its doodle now
	Current  bool   `json:"current"`
	ArtistID string `json:"-"` // For the image URL of a real doodle
}

// AIRunMetadata is what the judge saw and how its scores were adjusted in code after it answered.
// Runs logged before it was kept have none.
type AIRunMetadata struct {
	Seen          string  `json:"seen,omitempty"`          // What the judge thought the drawing showed
	Idea          string  `json:"idea,omitempty"`          // What it thought the artist was going for
	Notable       string  `json:"notable,omitempty"`       // What it passed on to joke about
	Effort        string  `json:"effort,omitempty"`        // real, low or none
	EffortPenalty float64 `json:"effortPenalty,omitempty"` // Share taken off the overall score
	Prompt        string  `json:"prompt,omitempty"`        // nailed, complete, partial or missed
	PromptMissing string  `json:"promptMissing,omitempty"` // The parts of the prompt it found missing
	PromptBonus   float64 `json:"promptBonus,omitempty"`   // Added to every score
	Swing         string  `json:"swing,omitempty"`         // The random swing: "boost", "super" or none
	SwingPoints   float64 `json:"swingPoints,omitempty"`   // Added to every score (negative when hated)
	// How the swing was rolled, and how the judge's answer became its scores. Runs logged
	// before these were kept have neither.
	SwingRoll *models.AISwingRoll      `json:"swingRoll,omitempty"`
	Breakdown *models.AIScoreBreakdown `json:"breakdown,omitempty"`
	// Every call made to the model, in order, as sent and answered (kept on failed runs too).
	// Runs from before judging took two calls have none.
	Calls []models.AICall `json:"calls,omitempty"`
}

// LogAIRun records a judge call. It never fails the caller: the log is for watching.
func LogAIRun(repo *sql.DB, ctx context.Context, run AIRun) (string, error) {
	if run.ID == "" {
		run.ID = uuid.New().String()
	}
	criteria := run.Criteria
	if criteria == nil {
		criteria = []models.AICriterionScore{}
	}
	criteriaJSON, err := json.Marshal(criteria)
	if err != nil {
		return "", err
	}
	metadataJSON, err := json.Marshal(run.Metadata)
	if err != nil {
		return "", err
	}
	var userID any
	if run.User != nil && run.User.ID != "" {
		userID = run.User.ID
	}
	var submissionID any
	if run.SubmissionID != nil {
		submissionID = *run.SubmissionID
	}
	_, err = repo.ExecContext(ctx, `
		INSERT INTO ai_runs (id, kind, batch_id, personality_id, judge_name, judge_avatar_url, judge_decoration, system_prompt,
			submission_id, prompt, image_data, user_id, status, score, criteria_scores, comment, model, error, duration_ms, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		run.ID, run.Kind, run.BatchID, run.PersonalityID, run.JudgeName, run.JudgeAvatarURL, run.JudgeDecoration, run.SystemPrompt,
		submissionID, run.Prompt, run.ImageData, userID, run.Status, run.Score, string(criteriaJSON), run.Comment, run.Model,
		run.Error, run.DurationMS, string(metadataJSON))
	if err != nil {
		return "", fmt.Errorf("error logging AI run: %w", err)
	}
	return run.ID, nil
}

// ListAIRuns returns the newest runs, newest first.
func ListAIRuns(repo *sql.DB, ctx context.Context, limit int) ([]AIRun, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT r.id, r.kind, r.batch_id, r.personality_id, r.judge_name, r.judge_avatar_url, r.judge_decoration, r.system_prompt,
			r.submission_id, r.prompt, r.image_data, r.status, r.score, r.criteria_scores, r.comment, r.model, r.error,
			r.duration_ms, r.metadata, r.created_at, COALESCE(s.user_id, ''),
			u.id, u.username, u.created_at, u.avatar_type, u.avatar_url, u.decoration,
			r.applied_at, COALESCE(rv.run_id = r.id AND rv.status = 'done', 0)
		FROM ai_runs r
		LEFT JOIN user_submissions s ON s.id = r.submission_id
		LEFT JOIN ai_reviews rv ON rv.submission_id = r.submission_id
		LEFT JOIN users u ON u.id = r.user_id
		ORDER BY datetime(r.created_at) DESC, r.rowid DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("error listing AI runs: %w", err)
	}
	defer rows.Close()

	runs := []AIRun{}
	for rows.Next() {
		var (
			run                                                 AIRun
			submissionID                                        sql.NullString
			score                                               sql.NullFloat64
			criteriaJSON, metadataJSON                          string
			userID, username, avatarType, avatarURL, decoration sql.NullString
			userCreatedAt, appliedAt                            sql.NullTime
		)
		err := rows.Scan(&run.ID, &run.Kind, &run.BatchID, &run.PersonalityID, &run.JudgeName, &run.JudgeAvatarURL,
			&run.JudgeDecoration, &run.SystemPrompt, &submissionID, &run.Prompt, &run.ImageData, &run.Status, &score,
			&criteriaJSON, &run.Comment, &run.Model, &run.Error, &run.DurationMS, &metadataJSON, &run.CreatedAt, &run.ArtistID,
			&userID, &username, &userCreatedAt, &avatarType, &avatarURL, &decoration, &appliedAt, &run.Current)
		if err != nil {
			return nil, fmt.Errorf("error scanning AI run: %w", err)
		}
		if submissionID.Valid {
			run.SubmissionID = &submissionID.String
		}
		if score.Valid {
			s := score.Float64
			run.Score = &s
		}
		if appliedAt.Valid {
			at := appliedAt.Time
			run.AppliedAt = &at
		}
		run.Criteria = []models.AICriterionScore{}
		_ = json.Unmarshal([]byte(criteriaJSON), &run.Criteria)
		_ = json.Unmarshal([]byte(metadataJSON), &run.Metadata)
		if userID.Valid {
			run.User = &models.User{
				ID: userID.String, Username: username.String, CreatedAt: userCreatedAt.Time,
				AvatarType: avatarType.String, AvatarURL: avatarURL.String, Decoration: decoration.String,
			}
		}
		runs = append(runs, run)
	}
	return runs, rows.Err()
}

// Why a run can't become its doodle's review.
var (
	ErrAIRunNoDoodle  = errors.New("this run judged a custom drawing, not a player's doodle")
	ErrAIRunFailed    = errors.New("this run failed, so there's no review to apply")
	ErrAIRunJudgeGone = errors.New("this run's judge isn't saved anymore, so it can't review a doodle")
)

// ApplyAIRun makes a logged run its doodle's review, replacing whatever players saw before
// (the bell shows it as new, and the judge's dialogue plays for the artist once more). The run
// is marked applied in the AI log. Returns sql.ErrNoRows for no such run.
func ApplyAIRun(repo *sql.DB, ctx context.Context, runID string) error {
	return withEventTx(repo, ctx, func(tx *sql.Tx) error {
		var (
			submissionID                                 sql.NullString
			personalityID, status, criteria, comment, md string
			score                                        sql.NullFloat64
		)
		err := tx.QueryRowContext(ctx, `
			SELECT submission_id, personality_id, status, score, criteria_scores, comment, model
			FROM ai_runs WHERE id = ?`, runID).Scan(&submissionID, &personalityID, &status, &score, &criteria, &comment, &md)
		if err != nil {
			return err
		}
		switch {
		case !submissionID.Valid || submissionID.String == "":
			return ErrAIRunNoDoodle
		case status != "done" || !score.Valid:
			return ErrAIRunFailed
		}
		var judgeSaved bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM ai_personalities WHERE id = ?)`, personalityID).Scan(&judgeSaved); err != nil {
			return err
		}
		if !judgeSaved {
			return ErrAIRunJudgeGone
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO ai_reviews (submission_id, personality_id, status, score, criteria_scores, comment, model, run_id)
			VALUES (?, ?, 'done', ?, ?, ?, ?, ?)
			ON CONFLICT (submission_id) DO UPDATE SET
				personality_id = excluded.personality_id, status = 'done', score = excluded.score,
				criteria_scores = excluded.criteria_scores, comment = excluded.comment, model = excluded.model,
				run_id = excluded.run_id, error = '', created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
				heard_at = NULL`,
			submissionID.String, personalityID, score.Float64, criteria, comment, md, runID)
		if err != nil {
			return fmt.Errorf("error applying AI run %s: %w", runID, err)
		}
		_, err = tx.ExecContext(ctx, `UPDATE ai_runs SET applied_at = CURRENT_TIMESTAMP WHERE id = ?`, runID)
		return err
	})
}

// AIRunStats counts every run ever logged, not just the ones listed.
type AIRunStats struct {
	Total       int `json:"total"`
	Submissions int `json:"submissions"`
	Reruns      int `json:"reruns"`
	Tests       int `json:"tests"`
	Failed      int `json:"failed"`
	Today       int `json:"today"`
	// Average duration of successful runs, in milliseconds
	AvgDurationMS int `json:"avgDurationMs"`
}

func GetAIRunStats(repo *sql.DB, ctx context.Context) (AIRunStats, error) {
	var stats AIRunStats
	err := repo.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COALESCE(SUM(kind = 'submission'), 0),
			COALESCE(SUM(kind = 'rerun'), 0),
			COALESCE(SUM(kind = 'test'), 0),
			COALESCE(SUM(status = 'failed'), 0),
			COALESCE(SUM(date(created_at) = date('now')), 0),
			COALESCE(CAST(AVG(CASE WHEN status = 'done' THEN duration_ms END) AS INTEGER), 0)
		FROM ai_runs`).Scan(&stats.Total, &stats.Submissions, &stats.Reruns, &stats.Tests, &stats.Failed, &stats.Today, &stats.AvgDurationMS)
	if err != nil {
		return stats, fmt.Errorf("error counting AI runs: %w", err)
	}
	return stats, nil
}
