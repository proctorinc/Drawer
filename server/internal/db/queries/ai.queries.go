package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// --- Settings ---

// GetAISettings returns every AI setting as key -> value.
func GetAISettings(repo *sql.DB, ctx context.Context) (map[string]string, error) {
	rows, err := repo.QueryContext(ctx, `SELECT key, value FROM ai_settings`)
	if err != nil {
		return nil, fmt.Errorf("error fetching AI settings: %w", err)
	}
	defer rows.Close()

	settings := map[string]string{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, fmt.Errorf("error scanning AI setting: %w", err)
		}
		settings[key] = value
	}
	return settings, rows.Err()
}

// SetAISettings saves the given settings, leaving the rest as they are.
func SetAISettings(repo *sql.DB, ctx context.Context, values map[string]string) error {
	return withEventTx(repo, ctx, func(tx *sql.Tx) error {
		for key, value := range values {
			_, err := tx.ExecContext(ctx, `
				INSERT INTO ai_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
				key, value)
			if err != nil {
				return fmt.Errorf("error saving AI setting %s: %w", key, err)
			}
		}
		return nil
	})
}

// --- Personalities ---

const aiPersonalityColumns = `id, slug, name, bio, system_prompt, avatar_url, decoration, is_default, event_id, enabled, created_at`

func scanAIPersonality(row eventRowScanner) (models.AIPersonality, error) {
	var (
		p       models.AIPersonality
		eventID sql.NullString
	)
	err := row.Scan(&p.ID, &p.Slug, &p.Name, &p.Bio, &p.SystemPrompt, &p.AvatarURL, &p.Decoration,
		&p.IsDefault, &eventID, &p.Enabled, &p.CreatedAt)
	if err != nil {
		return models.AIPersonality{}, err
	}
	if eventID.Valid && eventID.String != "" {
		p.EventID = &eventID.String
	}
	p.Criteria = []models.AICriterion{}
	return p, nil
}

func getAICriteria(repo *sql.DB, ctx context.Context, personalityID string) ([]models.AICriterion, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT id, name, description, image_url FROM ai_criteria
		WHERE personality_id = ? ORDER BY position ASC`, personalityID)
	if err != nil {
		return nil, fmt.Errorf("error fetching criteria for %s: %w", personalityID, err)
	}
	defer rows.Close()

	criteria := []models.AICriterion{}
	for rows.Next() {
		var c models.AICriterion
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.ImageURL); err != nil {
			return nil, fmt.Errorf("error scanning criterion: %w", err)
		}
		criteria = append(criteria, c)
	}
	return criteria, rows.Err()
}

func getAIPersonality(repo *sql.DB, ctx context.Context, where string, args ...any) (models.AIPersonality, error) {
	p, err := scanAIPersonality(repo.QueryRowContext(ctx, `SELECT `+aiPersonalityColumns+` FROM ai_personalities `+where, args...))
	if err != nil {
		return models.AIPersonality{}, err
	}
	if p.Criteria, err = getAICriteria(repo, ctx, p.ID); err != nil {
		return models.AIPersonality{}, err
	}
	return p, nil
}

// GetAIPersonality returns a personality with its criteria, or sql.ErrNoRows.
func GetAIPersonality(repo *sql.DB, ctx context.Context, id string) (models.AIPersonality, error) {
	return getAIPersonality(repo, ctx, `WHERE id = ?`, id)
}

// PickAIPersonality returns the judge for a doodle drawn now: the enabled judge of the
// running event (eventID, "" for none) if it has one, else the enabled default judge.
// Returns sql.ErrNoRows when neither exists.
func PickAIPersonality(repo *sql.DB, ctx context.Context, eventID string) (models.AIPersonality, error) {
	return getAIPersonality(repo, ctx, `
		WHERE enabled = 1 AND ((? <> '' AND event_id = ?) OR is_default = 1)
		ORDER BY (event_id IS NOT NULL AND event_id = ?) DESC, created_at DESC
		LIMIT 1`, eventID, eventID, eventID)
}

// ListAIPersonalities returns every personality with its criteria, the default first.
func ListAIPersonalities(repo *sql.DB, ctx context.Context) ([]models.AIPersonality, error) {
	rows, err := repo.QueryContext(ctx, `SELECT `+aiPersonalityColumns+` FROM ai_personalities ORDER BY is_default DESC, created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("error listing AI personalities: %w", err)
	}
	list := []models.AIPersonality{}
	for rows.Next() {
		p, err := scanAIPersonality(rows)
		if err != nil {
			rows.Close()
			return nil, fmt.Errorf("error scanning AI personality: %w", err)
		}
		list = append(list, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Criteria after the rows are closed: local SQLite has a single connection
	for i := range list {
		if list[i].Criteria, err = getAICriteria(repo, ctx, list[i].ID); err != nil {
			return nil, err
		}
	}
	return list, nil
}

// IsAIPersonalitySlugTaken reports whether a personality other than exceptID uses slug.
func IsAIPersonalitySlugTaken(repo *sql.DB, ctx context.Context, slug, exceptID string) (bool, error) {
	var taken bool
	err := repo.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM ai_personalities WHERE slug = ? AND id <> ?)`, slug, exceptID).Scan(&taken)
	return taken, err
}

// SaveAIPersonality creates the personality (when its ID is empty) or updates it, replacing
// its criteria. Making it the default unsets the old default.
func SaveAIPersonality(repo *sql.DB, ctx context.Context, p models.AIPersonality) (models.AIPersonality, error) {
	creating := p.ID == ""
	if creating {
		p.ID = uuid.New().String()
	}

	err := withEventTx(repo, ctx, func(tx *sql.Tx) error {
		if p.IsDefault {
			if _, err := tx.ExecContext(ctx, `UPDATE ai_personalities SET is_default = 0 WHERE is_default = 1 AND id <> ?`, p.ID); err != nil {
				return err
			}
		}

		var eventID any
		if p.EventID != nil && *p.EventID != "" {
			eventID = *p.EventID
		}

		if creating {
			_, err := tx.ExecContext(ctx, `
				INSERT INTO ai_personalities (id, slug, name, bio, system_prompt, avatar_url, decoration, is_default, event_id, enabled)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				p.ID, p.Slug, p.Name, p.Bio, p.SystemPrompt, p.AvatarURL, p.Decoration, p.IsDefault, eventID, p.Enabled)
			if err != nil {
				return err
			}
		} else {
			res, err := tx.ExecContext(ctx, `
				UPDATE ai_personalities SET slug = ?, name = ?, bio = ?, system_prompt = ?, avatar_url = ?, decoration = ?,
					is_default = ?, event_id = ?, enabled = ?
				WHERE id = ?`,
				p.Slug, p.Name, p.Bio, p.SystemPrompt, p.AvatarURL, p.Decoration, p.IsDefault, eventID, p.Enabled, p.ID)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n == 0 {
				return sql.ErrNoRows
			}
		}

		if _, err := tx.ExecContext(ctx, `DELETE FROM ai_criteria WHERE personality_id = ?`, p.ID); err != nil {
			return err
		}
		for i := range p.Criteria {
			// Keep a criterion's id across edits, so old reviews' snapshots still line up
			if p.Criteria[i].ID == "" {
				p.Criteria[i].ID = uuid.New().String()
			}
			c := p.Criteria[i]
			_, err := tx.ExecContext(ctx, `
				INSERT INTO ai_criteria (id, personality_id, position, name, description, image_url)
				VALUES (?, ?, ?, ?, ?, ?)`,
				c.ID, p.ID, i, c.Name, c.Description, c.ImageURL)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return models.AIPersonality{}, err
	}
	return GetAIPersonality(repo, ctx, p.ID)
}

// ErrAIPersonalityInUse is returned when deleting a personality that has reviews.
var ErrAIPersonalityInUse = errors.New("personality has reviews")

// DeleteAIPersonality deletes a personality that hasn't reviewed anything yet.
func DeleteAIPersonality(repo *sql.DB, ctx context.Context, id string) error {
	var used bool
	if err := repo.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM ai_reviews WHERE personality_id = ?)`, id).Scan(&used); err != nil {
		return err
	}
	if used {
		return ErrAIPersonalityInUse
	}
	res, err := repo.ExecContext(ctx, `DELETE FROM ai_personalities WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	_, err = repo.ExecContext(ctx, `DELETE FROM ai_criteria WHERE personality_id = ?`, id)
	return err
}

// --- Reviews ---

// StartAIReview marks a doodle as being judged by personality, replacing any earlier review.
func StartAIReview(repo *sql.DB, ctx context.Context, submissionID string, p models.AIPersonality) error {
	_, err := repo.ExecContext(ctx, `
		INSERT INTO ai_reviews (submission_id, personality_id, status)
		VALUES (?, ?, 'pending')
		ON CONFLICT (submission_id) DO UPDATE SET
			personality_id = excluded.personality_id, status = 'pending', score = NULL,
			criteria_scores = '[]', comment = '', error = '', created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
			heard_at = NULL`,
		submissionID, p.ID)
	if err != nil {
		return fmt.Errorf("error starting AI review of %s: %w", submissionID, err)
	}
	return nil
}

// FinishAIReview saves a judge's verdict on a doodle.
func FinishAIReview(repo *sql.DB, ctx context.Context, submissionID string, score float64, criteria []models.AICriterionScore, comment, model string) error {
	if criteria == nil {
		criteria = []models.AICriterionScore{}
	}
	criteriaJSON, err := json.Marshal(criteria)
	if err != nil {
		return err
	}
	_, err = repo.ExecContext(ctx, `
		UPDATE ai_reviews SET status = 'done', score = ?, criteria_scores = ?, comment = ?, model = ?, error = '', updated_at = CURRENT_TIMESTAMP
		WHERE submission_id = ?`,
		score, string(criteriaJSON), comment, model, submissionID)
	if err != nil {
		return fmt.Errorf("error saving AI review of %s: %w", submissionID, err)
	}
	return nil
}

// FailAIReview records why a doodle couldn't be judged; players never see a failed review.
func FailAIReview(repo *sql.DB, ctx context.Context, submissionID, reason string) error {
	_, err := repo.ExecContext(ctx, `
		UPDATE ai_reviews SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE submission_id = ?`,
		reason, submissionID)
	return err
}

const aiReviewColumns = `r.submission_id, r.status, r.score, r.criteria_scores, r.comment, r.model, r.error, r.created_at,
	p.id, p.name, p.bio, p.avatar_url, p.decoration`

func scanAIReview(row eventRowScanner) (models.AIReview, error) {
	var (
		review       models.AIReview
		score        sql.NullFloat64
		criteriaJSON string
	)
	err := row.Scan(&review.SubmissionID, &review.Status, &score, &criteriaJSON, &review.Comment,
		&review.Model, &review.Error, &review.CreatedAt,
		&review.Judge.ID, &review.Judge.Name, &review.Judge.Bio, &review.Judge.AvatarURL, &review.Judge.Decoration)
	if err != nil {
		return models.AIReview{}, err
	}
	if score.Valid {
		s := score.Float64
		review.Score = &s
	}
	review.Criteria = []models.AICriterionScore{}
	if criteriaJSON != "" {
		_ = json.Unmarshal([]byte(criteriaJSON), &review.Criteria)
	}
	return review, nil
}

// A pending review this old was cut off (say, by a restart), so players stop seeing it.
const staleAIReviewAfter = 5 * time.Minute

// GetAIReviews returns the reviews players can see (done, or still being written) for the
// given doodles, by submission id.
func GetAIReviews(repo *sql.DB, ctx context.Context, submissionIDs []string) (map[string]models.AIReview, error) {
	reviews := map[string]models.AIReview{}
	if len(submissionIDs) == 0 {
		return reviews, nil
	}

	args := make([]any, 0, len(submissionIDs)+1)
	for _, id := range submissionIDs {
		args = append(args, id)
	}
	args = append(args, time.Now().UTC().Add(-staleAIReviewAfter).Format("2006-01-02 15:04:05"))

	rows, err := repo.QueryContext(ctx, `
		SELECT `+aiReviewColumns+`
		FROM ai_reviews r JOIN ai_personalities p ON p.id = r.personality_id
		WHERE r.submission_id IN (?`+strings.Repeat(", ?", len(submissionIDs)-1)+`)
			AND (r.status = 'done' OR (r.status = 'pending' AND datetime(r.updated_at) > datetime(?)))`, args...)
	if err != nil {
		return nil, fmt.Errorf("error fetching AI reviews: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		review, err := scanAIReview(rows)
		if err != nil {
			return nil, fmt.Errorf("error scanning AI review: %w", err)
		}
		reviews[review.SubmissionID] = review
	}
	return reviews, rows.Err()
}

// AttachAIReviews sets AIReview on each submission that has a review players can see.
func AttachAIReviews(repo *sql.DB, ctx context.Context, submissions []*models.UserPromptSubmission) error {
	ids := make([]string, 0, len(submissions))
	for _, s := range submissions {
		ids = append(ids, s.ID)
	}
	reviews, err := GetAIReviews(repo, ctx, ids)
	if err != nil {
		return err
	}
	for _, s := range submissions {
		if review, ok := reviews[s.ID]; ok {
			s.AIReview = &review
		}
	}
	return nil
}

// AdminAIReview is a review with what admins need to judge the judge.
type AdminAIReview struct {
	models.AIReview
	Model    string      `json:"model"`
	Error    string      `json:"error"`
	Prompt   string      `json:"prompt"`
	Day      string      `json:"day"`
	ImageURL string      `json:"imageUrl"`
	Artist   models.User `json:"artist"`
}

// ListRecentAIReviews returns the newest reviews of every status, newest first.
func ListRecentAIReviews(repo *sql.DB, ctx context.Context, limit int) ([]AdminAIReview, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT `+aiReviewColumns+`, dp.prompt, s.day, u.id, u.username, u.created_at, u.avatar_type, u.avatar_url, u.decoration
		FROM ai_reviews r
		JOIN ai_personalities p ON p.id = r.personality_id
		JOIN user_submissions s ON s.id = r.submission_id
		JOIN users u ON u.id = s.user_id
		LEFT JOIN daily_prompts dp ON dp.day = s.day
		ORDER BY datetime(r.created_at) DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("error listing AI reviews: %w", err)
	}
	defer rows.Close()

	list := []AdminAIReview{}
	for rows.Next() {
		var (
			review       AdminAIReview
			score        sql.NullFloat64
			criteriaJSON string
			prompt       sql.NullString
		)
		err := rows.Scan(&review.SubmissionID, &review.Status, &score, &criteriaJSON, &review.Comment,
			&review.Model, &review.Error, &review.CreatedAt,
			&review.Judge.ID, &review.Judge.Name, &review.Judge.Bio, &review.Judge.AvatarURL, &review.Judge.Decoration,
			&prompt, &review.Day, &review.Artist.ID, &review.Artist.Username, &review.Artist.CreatedAt,
			&review.Artist.AvatarType, &review.Artist.AvatarURL, &review.Artist.Decoration)
		if err != nil {
			return nil, fmt.Errorf("error scanning AI review: %w", err)
		}
		if score.Valid {
			s := score.Float64
			review.Score = &s
		}
		review.Criteria = []models.AICriterionScore{}
		_ = json.Unmarshal([]byte(criteriaJSON), &review.Criteria)
		review.Prompt = prompt.String
		list = append(list, review)
	}
	return list, rows.Err()
}

// SubmissionForAIReview is what a judge needs to know about a doodle besides its image.
type SubmissionForAIReview struct {
	ID     string
	UserID string
	Day    string
	Prompt string
}

// GetSubmissionForAIReview returns a doodle's artist and prompt, or sql.ErrNoRows.
func GetSubmissionForAIReview(repo *sql.DB, ctx context.Context, submissionID string) (SubmissionForAIReview, error) {
	var (
		sub    SubmissionForAIReview
		prompt sql.NullString
	)
	err := repo.QueryRowContext(ctx, `
		SELECT s.id, s.user_id, s.day, dp.prompt
		FROM user_submissions s LEFT JOIN daily_prompts dp ON dp.day = s.day
		WHERE s.id = ?`, submissionID).Scan(&sub.ID, &sub.UserID, &sub.Day, &prompt)
	sub.Prompt = prompt.String
	return sub, err
}

// GetAIReviewActivity returns the AI judges' finished reviews of your doodles from the last
// week, dated when the judge finished, for the activity bell.
func GetAIReviewActivity(repo *sql.DB, ctx context.Context, userID string, cfg *config.Config) ([]models.Activity, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT `+aiReviewColumns+`, r.updated_at, r.heard_at, COALESCE(dp.prompt, ''), `+activityUserColumns("u")+`
		FROM ai_reviews r
		JOIN ai_personalities p ON p.id = r.personality_id
		JOIN user_submissions s ON s.id = r.submission_id
		JOIN users u ON u.id = s.user_id
		LEFT JOIN daily_prompts dp ON dp.day = s.day
		WHERE s.user_id = ? AND r.status = 'done' AND r.updated_at >= `+activityWindow+`
		ORDER BY r.updated_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("error fetching AI review activity: %w", err)
	}
	defer rows.Close()

	activities := []models.Activity{}
	for rows.Next() {
		var (
			review   models.AIReview
			score    sql.NullFloat64
			criteria string
			judgedAt time.Time
			heardAt  sql.NullTime
			prompt   string
			artist   models.User
		)
		dest := append([]any{&review.SubmissionID, &review.Status, &score, &criteria, &review.Comment,
			&review.Model, &review.Error, &review.CreatedAt,
			&review.Judge.ID, &review.Judge.Name, &review.Judge.Bio, &review.Judge.AvatarURL, &review.Judge.Decoration,
			&judgedAt, &heardAt, &prompt}, activityUserDest(&artist)...)
		if err := rows.Scan(dest...); err != nil {
			return nil, fmt.Errorf("error scanning AI review activity: %w", err)
		}
		if score.Valid {
			review.Score = &score.Float64
		}
		review.Criteria = []models.AICriterionScore{}
		_ = json.Unmarshal([]byte(criteria), &review.Criteria)
		review.Heard = heardAt.Valid
		activities = append(activities, models.Activity{
			ID:       "ai-review-" + review.SubmissionID,
			User:     artist,
			Action:   models.ActivityActionAIReview,
			Date:     judgedAt,
			AIReview: &review,
			Submission: &models.ActivitySubmission{
				ID:       review.SubmissionID,
				Prompt:   prompt,
				ImageUrl: utils.GetImageUrl(cfg, utils.GetSubmissionFilename(artist.ID, review.SubmissionID)),
				Artist:   artist,
			},
		})
	}
	return activities, rows.Err()
}

// MarkAIReviewHeard records that the artist has heard their judge's review (its dialogue
// played), so it counts as read on every device. Someone else's doodle is left alone.
func MarkAIReviewHeard(repo *sql.DB, ctx context.Context, submissionID, userID string) error {
	_, err := repo.ExecContext(ctx, `
		UPDATE ai_reviews SET heard_at = CURRENT_TIMESTAMP
		WHERE submission_id = ? AND status = 'done' AND heard_at IS NULL
			AND submission_id IN (SELECT id FROM user_submissions WHERE user_id = ?)`,
		submissionID, userID)
	if err != nil {
		return fmt.Errorf("error marking AI review of %s heard: %w", submissionID, err)
	}
	return nil
}
