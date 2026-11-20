// Package ai has AI judges score doodles and comment on them in character.
package ai

import (
	"bytes"
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
const baseRules = `You judge doodles in a daily drawing game between friends. Everyone draws the same prompt each day.

Background, for scoring only (never mention any of it in your comment):
- Doodles are drawn with a finger on a small phone canvas, with one thick round brush, an eraser and undo: no thin lines, fills, shapes or text tool. Fine detail and shading are near impossible, so bold, simple shapes are good doodling. Judge what was possible, not against fine art.
- Everyone gets the same 3 colors each day, picked at random, so they often don't suit the prompt. Never mark a doodle down for its colors; give credit for clever use of them.
- A great doodle reads clearly at a glance and gets the most out of very little.

Your comment:
- It is a joke, not a review. Find one specific, concrete thing in this drawing (a wobbly leg, a suspicious blob, a face that's off, how tiny or huge something is, an odd color, something lurking in a corner) and build your joke around it, in your own voice.
- Roast or tease the artist about what they drew and the choices they made, the way a funny friend would. Keep it PG: nothing about their looks, identity, intelligence or anything personal beyond this drawing.
- Never mention the brush, the colors being random, the canvas, the phone, the game, these rules, the scores or how you judge. Talk only about what's on the page.
- No generic praise or criticism ("great job", "nice effort", "could use more detail"). If it would fit any other doodle, rewrite it.
- If you can't really tell what it is, or it looks more like something else, say what it looks like to you instead, as the joke.
- One or two short sentences, at most %d words. No hashtags.

Scoring rules:
- First write in "seen" what you honestly think the drawing shows, before reading it as the prompt, and score how recognizable it is to match.
- In "effort", say how much effort went into the doodle. Answer "low" or "none" only when it's obvious the artist barely tried: a blank canvas, a single stray line, or a few careless scribbles. A simple, rough, clumsy, badly drawn or labelled doodle is still a real attempt, so answer "real". When in doubt, answer "real".
- If the image is blank or has nothing to do with the prompt, say so in character and score it low.

Stay fully in character. Reply only with the JSON you're asked for.`

// Effort is how hard the artist clearly tried.
const (
	EffortReal = "real" // A genuine attempt, however simple or rough
	EffortLow  = "low"  // Obviously rushed: a few careless scribbles
	EffortNone = "none" // Blank, a stray line, or nothing to do with drawing anything
)

// effortPenalties take this share off a doodle's overall score when it's clear little or no
// effort went into it. Players are never told: the criteria scores stay as the judge gave them.
var effortPenalties = map[string]float64{EffortLow: 0.25, EffortNone: 0.5}

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
	// What the judge thought the drawing showed, before reading it as the prompt
	Seen string
	// How hard the artist clearly tried (EffortReal, EffortLow or EffortNone)
	Effort string
	// The share taken off the overall score for little or no effort, already applied to Score
	EffortPenalty float64
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
// strict mode: every property required, no extras). The model answers in the order the
// properties are listed, so it says what it sees before scoring, and scores before commenting.
func ResponseSchema(p models.AIPersonality) map[string]any {
	properties := orderedObject{
		{"seen", map[string]any{"type": "string"}},
		{"effort", map[string]any{"type": "string", "enum": []string{EffortReal, EffortLow, EffortNone}}},
	}
	if len(p.Criteria) > 0 {
		ids := make([]string, 0, len(p.Criteria))
		for _, c := range p.Criteria {
			ids = append(ids, c.ID)
		}
		properties = append(properties, field{"criteria", map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": orderedObject{
					{"id", map[string]any{"type": "string", "enum": ids}},
					{"score", map[string]any{"type": "integer"}},
				},
				"required":             []string{"id", "score"},
				"additionalProperties": false,
			},
		}})
	}
	properties = append(properties,
		field{"score", map[string]any{"type": "integer"}},
		field{"comment", map[string]any{"type": "string"}},
	)

	required := make([]string, len(properties))
	for i, f := range properties {
		required[i] = f.Key
	}
	return map[string]any{
		"type":                 "object",
		"properties":           properties,
		"required":             required,
		"additionalProperties": false,
	}
}

// field is one entry of an orderedObject.
type field struct {
	Key   string
	Value any
}

// orderedObject is a JSON object that keeps its keys in order (a map would sort them).
type orderedObject []field

func (o orderedObject) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, f := range o {
		if i > 0 {
			b.WriteByte(',')
		}
		key, err := json.Marshal(f.Key)
		if err != nil {
			return nil, err
		}
		value, err := json.Marshal(f.Value)
		if err != nil {
			return nil, err
		}
		b.Write(key)
		b.WriteByte(':')
		b.Write(value)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

type rawVerdict struct {
	Seen     string `json:"seen"`
	Effort   string `json:"effort"`
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
// Doodles that clearly took little or no effort then lose a share of the overall score.
func ParseVerdict(raw string, p models.AIPersonality) (Verdict, error) {
	var rv rawVerdict
	if err := json.Unmarshal([]byte(raw), &rv); err != nil {
		return Verdict{}, fmt.Errorf("judge's answer isn't valid JSON: %w", err)
	}

	comment := trimComment(rv.Comment)
	if comment == "" {
		return Verdict{}, fmt.Errorf("judge left an empty comment")
	}

	verdict := Verdict{Comment: comment, Score: float64(clamp(rv.Score, 1, models.AIScoreMax)), Seen: strings.TrimSpace(rv.Seen), Effort: EffortReal}
	if _, ok := effortPenalties[rv.Effort]; ok {
		verdict.Effort = rv.Effort
	}
	verdict.EffortPenalty = effortPenalties[verdict.Effort]
	if len(p.Criteria) > 0 {
		verdict.Criteria, verdict.Score = scoreCriteria(rv, p)
	}
	if verdict.EffortPenalty > 0 {
		verdict.Score = max(1, math.Round(verdict.Score*(1-verdict.EffortPenalty)*10)/10)
	}
	return verdict, nil
}

// scoreCriteria fits the judge's criteria scores to the personality and averages them.
func scoreCriteria(rv rawVerdict, p models.AIPersonality) ([]models.AICriterionScore, float64) {
	given := map[string]int{}
	for _, c := range rv.Criteria {
		given[c.ID] = c.Score
	}
	var criteria []models.AICriterionScore
	total := 0
	for _, c := range p.Criteria {
		score, ok := given[c.ID]
		if !ok {
			score = models.AIScoreMax / 2
		}
		score = clamp(score, 1, models.AIScoreMax)
		criteria = append(criteria, models.AICriterionScore{AICriterion: c, Score: score})
		total += score
	}
	return criteria, math.Round(float64(total)/float64(len(p.Criteria))*10) / 10
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
