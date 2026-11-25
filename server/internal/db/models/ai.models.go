package models

import (
	"encoding/json"
	"time"
)

// AIPersonality is an AI judge's character: who it is, how it talks and what it scores.
type AIPersonality struct {
	ID           string  `json:"id"`
	Slug         string  `json:"slug"`
	Name         string  `json:"name"`
	Bio          string  `json:"bio"`          // A sentence or two about them, shown when players tap their face
	SystemPrompt string  `json:"systemPrompt"` // Its character, as instructions to the model
	AvatarURL    string  `json:"avatarUrl"`
	Decoration   string  `json:"decoration"` // An AI-only decoration id the frontend draws, or ""
	IsDefault    bool    `json:"isDefault"`  // Judges every day no event judge covers
	EventID      *string `json:"eventId"`    // Judges instead of the default while this event runs
	Enabled      bool    `json:"enabled"`
	// Its criteria measure faults (gloom, mess, missing the prompt), so the better the doodle,
	// the lower its scores; a 0 is the best a doodle can do. Players aren't told.
	ScoresBackwards bool          `json:"scoresBackwards"`
	Criteria        []AICriterion `json:"criteria"` // At most MaxAICriteria; none means one overall score
	CreatedAt       time.Time     `json:"createdAt"`
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
	// Scores faults, so its scores earn nothing (no XP bonus, gold frame or score achievements)
	ScoresBackwards bool `json:"scoresBackwards,omitempty"`
}

// Judge is the personality's public face, as players see it.
func (p AIPersonality) Judge() AIJudge {
	return AIJudge{ID: p.ID, Name: p.Name, Bio: p.Bio, AvatarURL: p.AvatarURL, Decoration: p.Decoration, ScoresBackwards: p.ScoresBackwards}
}

// AICriterionScore is a criterion as it was when the doodle was judged, and its score
// (out of AIScoreMax, to one decimal).
type AICriterionScore struct {
	AICriterion
	Score float64 `json:"score"`
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
	// The artist has heard it (its dialogue played); set on activity rows only
	Heard bool `json:"heard,omitempty"`
	// Admin-only details
	Model string `json:"-"`
	Error string `json:"-"`
}

// AIReply is something a judge said in a doodle's comments after its review, written when an
// admin asked for it.
type AIReply struct {
	ID        string    `json:"id"`
	Judge     AIJudge   `json:"judge"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"createdAt"`
}

// AISwingTier is how often a kind of swing happens and how many points it moves every score.
type AISwingTier struct {
	Kind   string  `json:"kind"`
	Chance float64 `json:"chance"`
	Min    float64 `json:"min"`
	Max    float64 `json:"max"`
}

// AISwingRoll is how a review's random swing was rolled, kept so admins can check the dice.
type AISwingRoll struct {
	// 0..1, walked through the tiers rarest first: under a tier's chance lands it, else that
	// chance is taken off and the next tier is tried
	Roll  float64       `json:"roll"`
	Tiers []AISwingTier `json:"tiers"` // The odds when it was rolled
	// Only for a swing: 0..1, where in the tier's range the points landed
	Size float64 `json:"size"`
	// Only for a swing: the coin flip, hated (points taken off) or loved
	Hates bool `json:"hates"`
}

// AICall is one request to the model during a judge run, exactly as it was sent and answered.
// A run makes two: "evaluate" reads and scores the doodle, then "comment" writes the
// judge's comment from that evaluation.
type AICall struct {
	Step    string `json:"step"`             // evaluate or comment
	System  string `json:"system"`           // The system prompt
	Message string `json:"message"`          // The user message sent with it
	Image   bool   `json:"image"`            // The doodle went along with the message
	Detail  string `json:"detail,omitempty"` // How closely the model looked at it: low or high
	// How much the answer was let vary; unset for the model's default
	Temperature *float64        `json:"temperature,omitempty"`
	Schema      json.RawMessage `json:"schema,omitempty"` // The JSON schema the answer had to fit
	Answer      string          `json:"answer"`           // The raw answer, as it came back
	Error       string          `json:"error,omitempty"`  // Why this call failed, when it did
	// How long the model took to answer
	DurationMS int64 `json:"durationMs"`
}

// AIScoreBreakdown is how a judge's answer became its scores, step by step.
type AIScoreBreakdown struct {
	// What the judge was told along with the doodle, and its answer. Only runs from before
	// judging took two calls have these; newer runs keep every call in full instead.
	Message string `json:"message,omitempty"`
	Answer  string `json:"answer,omitempty"`
	// The overall score the judge gave, and fitted to 1..AIScoreMax. With criteria it's
	// replaced by their average.
	GivenScore  float64           `json:"givenScore"`
	FittedScore float64           `json:"fittedScore"`
	Criteria    []AICriterionStep `json:"criteria,omitempty"`
	// The overall score after the prompt bonus and swing, before any effort penalty
	BeforeEffort float64 `json:"beforeEffort"`
	// What the judge said would have raised the overall score; only judges without criteria
	// give one (with criteria, each criterion has its own). Admin-only.
	Improve string `json:"improve,omitempty"`
}

// AICriterionStep is one criterion's score, from the judge's answer to the final score.
type AICriterionStep struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Given   float64 `json:"given"`             // As the judge gave it
	Skipped bool    `json:"skipped,omitempty"` // The judge left it out, so it got half marks
	Fitted  float64 `json:"fitted"`            // Rounded to one decimal and kept to 1..AIScoreMax
	Score   float64 `json:"score"`             // After the prompt bonus and swing, kept to 0..AIScoreMax
	Improve string  `json:"improve,omitempty"` // What the judge said would have raised it; admin-only
}
