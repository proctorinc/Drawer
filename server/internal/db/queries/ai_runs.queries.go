package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// AIRunKind is why a judge was asked about a doodle.
type AIRunKind string

const (
	AIRunSubmission AIRunKind = "submission" // A player drew it; the review is shown to players
	AIRunRerun      AIRunKind = "rerun"      // An admin re-judged a doodle; replaces its review
	AIRunTest       AIRunKind = "test"       // The admin testing ground; shown to no one
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
	ArtistID        string                    `json:"-"` // For the image URL of a real doodle
}

// AIRunMetadata is how a run's scores were adjusted in code after the judge answered.
// Runs logged before it was kept have none.
type AIRunMetadata struct {
	Seen          string  `json:"seen,omitempty"`          // What the judge thought the drawing showed
	Effort        string  `json:"effort,omitempty"`        // real, low or none
	EffortPenalty float64 `json:"effortPenalty,omitempty"` // Share taken off the overall score
	Prompt        string  `json:"prompt,omitempty"`        // nailed, complete, partial or missed
	PromptMissing string  `json:"promptMissing,omitempty"` // The parts of the prompt it found missing
	PromptBonus   float64 `json:"promptBonus,omitempty"`   // Added to every score
	Swing         string  `json:"swing,omitempty"`         // The random swing: "boost", "super" or none
	SwingPoints   float64 `json:"swingPoints,omitempty"`   // Added to every score (negative when hated)
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
			u.id, u.username, u.created_at, u.avatar_type, u.avatar_url, u.decoration
		FROM ai_runs r
		LEFT JOIN user_submissions s ON s.id = r.submission_id
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
			userCreatedAt                                       sql.NullTime
		)
		err := rows.Scan(&run.ID, &run.Kind, &run.BatchID, &run.PersonalityID, &run.JudgeName, &run.JudgeAvatarURL,
			&run.JudgeDecoration, &run.SystemPrompt, &submissionID, &run.Prompt, &run.ImageData, &run.Status, &score,
			&criteriaJSON, &run.Comment, &run.Model, &run.Error, &run.DurationMS, &metadataJSON, &run.CreatedAt, &run.ArtistID,
			&userID, &username, &userCreatedAt, &avatarType, &avatarURL, &decoration)
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
