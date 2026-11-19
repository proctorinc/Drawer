package models

import "time"

// AIPersonality is an AI judge's character: who it is, how it talks and what it scores.
type AIPersonality struct {
	ID           string        `json:"id"`
	Slug         string        `json:"slug"`
	Name         string        `json:"name"`
	Bio          string        `json:"bio"`          // A sentence or two about them, shown when players tap their face
	SystemPrompt string        `json:"systemPrompt"` // Its character, as instructions to the model
	AvatarURL    string        `json:"avatarUrl"`
	Decoration   string        `json:"decoration"` // An AI-only decoration id the frontend draws, or ""
	IsDefault    bool          `json:"isDefault"`  // Judges every day no event judge covers
	EventID      *string       `json:"eventId"`    // Judges instead of the default while this event runs
	Enabled      bool          `json:"enabled"`
	Criteria     []AICriterion `json:"criteria"` // At most MaxAICriteria; none means one overall score
	CreatedAt    time.Time     `json:"createdAt"`
}

// MaxAICriteria is how many criteria a judge can score separately.
const MaxAICriteria = 3

// AIScoreMax is what every AI score is out of: the overall score and each criterion's.
const AIScoreMax = 10

// AICriterion is one thing a judge scores on its own, like "christmas spirit".
type AICriterion struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"` // Tells the model (and players) what it measures
	ImageURL    string `json:"imageUrl"`    // Artwork shown next to its score
}

// AIReviewStatus is where a review is: being written, written, or given up on.
type AIReviewStatus string

const (
	AIReviewPending AIReviewStatus = "pending"
	AIReviewDone    AIReviewStatus = "done"
	AIReviewFailed  AIReviewStatus = "failed"
)

// AIJudge is the public face of a personality, as players see it next to a review.
type AIJudge struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Bio        string `json:"bio"`
	AvatarURL  string `json:"avatarUrl"`
	Decoration string `json:"decoration"`
}

// AICriterionScore is a criterion as it was when the doodle was judged, and its score
// (a whole number out of AIScoreMax).
type AICriterionScore struct {
	AICriterion
	Score int `json:"score"`
}

// AIReview is an AI judge's score and comment on a doodle.
type AIReview struct {
	SubmissionID string             `json:"submissionId"`
	Judge        AIJudge            `json:"judge"`
	Status       AIReviewStatus     `json:"status"`
	Score        *float64           `json:"score"` // Out of AIScoreMax, to one decimal; unset until done
	Criteria     []AICriterionScore `json:"criteria"`
	Comment      string             `json:"comment"`
	CreatedAt    time.Time          `json:"createdAt"`
	// Admin-only details
	Model string `json:"-"`
	Error string `json:"-"`
}
