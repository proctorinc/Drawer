// Package ai has AI judges score doodles and comment on them in character.
package ai

import (
	"drawer-service-backend/internal/db/models"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"unicode/utf8"
)

// MaxCommentWords is how long a judge's comment may be. Comments sit in a list of
// friends' comments, so they stay short.
const MaxCommentWords = 30

// maxCommentChars backs MaxCommentWords up, in case the model rambles anyway.
const maxCommentChars = 240

// baseRules apply to every judge, so a personality's prompt only has to describe its character.
const baseRules = `You judge doodles in Drawer, a daily drawing game between friends. Every day everyone draws the same prompt on their phone with a small palette of colors, so doodles are quick and rough: judge them as doodles, not fine art.

Rules:
- Stay fully in character.
- Keep it PG and playful. Tease the drawing, never the person: nothing about their looks, identity or intelligence.
- If the image is blank or has nothing to do with the prompt, say so in character and score it low.
- Your comment is one or two short sentences, at most %d words. No hashtags.
- Reply only with the JSON you're asked for.`

// Request is everything a judge needs to review one doodle.
type Request struct {
	Personality models.AIPersonality
	Prompt      string // The day's prompt, e.g. "a reindeer stuck in a chimney"
	Image       []byte // The doodle, as a PNG
}

// Verdict is a judge's review, checked and clamped to the 1..10 scale.
type Verdict struct {
	// Out of models.AIScoreMax: a whole number, or with criteria their average to one decimal
	Score    float64
	Criteria []models.AICriterionScore
	Comment  string
}

// SystemPrompt is the shared rules, the personality's character and how to score.
func SystemPrompt(p models.AIPersonality) string {
	var b strings.Builder
	fmt.Fprintf(&b, baseRules, MaxCommentWords)
	b.WriteString("\n\nWho you are:\n")
	b.WriteString(strings.TrimSpace(p.SystemPrompt))
	b.WriteString("\n\nScoring:\n")
	if len(p.Criteria) == 0 {
		fmt.Fprintf(&b, "Give the doodle one overall score, a whole number from 1 (dreadful) to %d (masterpiece). Use the whole range.\n", models.AIScoreMax)
	} else {
		fmt.Fprintf(&b, "Score the doodle on each of these, by id, each a whole number from 1 (dreadful) to %d (masterpiece). Use the whole range.\n", models.AIScoreMax)
		for _, c := range p.Criteria {
			fmt.Fprintf(&b, "- %s: %q. %s\n", c.ID, c.Name, strings.TrimSpace(c.Description))
		}
		fmt.Fprintf(&b, "Also give an overall score from 1 to %d; it is replaced by the average of the scores above.\n", models.AIScoreMax)
	}
	b.WriteString("Make your comment match your scores.")
	return b.String()
}

// UserPrompt introduces the doodle being judged.
func UserPrompt(prompt string) string {
	return fmt.Sprintf("Today's prompt was: %q. Here is the doodle. Review it.", prompt)
}

// ResponseSchema is the JSON schema the model must answer with (OpenAI structured outputs,
// strict mode: every property required, no extras).
func ResponseSchema(p models.AIPersonality) map[string]any {
	properties := map[string]any{}
	required := []string{}

	if len(p.Criteria) > 0 {
		ids := make([]string, 0, len(p.Criteria))
		for _, c := range p.Criteria {
			ids = append(ids, c.ID)
		}
		properties["criteria"] = map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"id":    map[string]any{"type": "string", "enum": ids},
					"score": map[string]any{"type": "integer"},
				},
				"required":             []string{"id", "score"},
				"additionalProperties": false,
			},
		}
		required = append(required, "criteria")
	}
	properties["score"] = map[string]any{"type": "integer"}
	properties["comment"] = map[string]any{"type": "string"}
	required = append(required, "score", "comment")

	return map[string]any{
		"type":                 "object",
		"properties":           properties,
		"required":             required,
		"additionalProperties": false,
	}
}

type rawVerdict struct {
	Criteria []struct {
		ID    string `json:"id"`
		Score int    `json:"score"`
	} `json:"criteria"`
	Score   int    `json:"score"`
	Comment string `json:"comment"`
}

// ParseVerdict reads the model's JSON answer and fits it to the personality. Every score is
// a whole number clamped to 1..10, and a criterion it skipped gets 5. With criteria, the
// overall score is their average to one decimal place (so it can't disagree with them).
func ParseVerdict(raw string, p models.AIPersonality) (Verdict, error) {
	var rv rawVerdict
	if err := json.Unmarshal([]byte(raw), &rv); err != nil {
		return Verdict{}, fmt.Errorf("judge's answer isn't valid JSON: %w", err)
	}

	comment := trimComment(rv.Comment)
	if comment == "" {
		return Verdict{}, fmt.Errorf("judge left an empty comment")
	}

	verdict := Verdict{Comment: comment, Score: float64(clamp(rv.Score, 1, models.AIScoreMax))}
	if len(p.Criteria) == 0 {
		return verdict, nil
	}

	given := map[string]int{}
	for _, c := range rv.Criteria {
		given[c.ID] = c.Score
	}
	total := 0
	for _, c := range p.Criteria {
		score, ok := given[c.ID]
		if !ok {
			score = models.AIScoreMax / 2
		}
		score = clamp(score, 1, models.AIScoreMax)
		verdict.Criteria = append(verdict.Criteria, models.AICriterionScore{AICriterion: c, Score: score})
		total += score
	}
	verdict.Score = math.Round(float64(total)/float64(len(p.Criteria))*10) / 10
	return verdict, nil
}

func clamp(n, lo, hi int) int {
	return min(max(n, lo), hi)
}

// trimComment tidies the comment and cuts a rambling one at a word boundary.
func trimComment(comment string) string {
	comment = strings.Join(strings.Fields(comment), " ")
	comment = strings.Trim(comment, `"`)
	if utf8.RuneCountInString(comment) <= maxCommentChars {
		return comment
	}
	runes := []rune(comment)[:maxCommentChars]
	cut := string(runes)
	if i := strings.LastIndex(cut, " "); i > maxCommentChars/2 {
		cut = cut[:i]
	}
	return strings.TrimRight(cut, ",;:- ") + "…"
}
