// Package ai has AI judges score doodles and comment on them in character.
package ai

import (
	"bytes"
	"drawer-service-backend/internal/db/models"
	"encoding/json"
	"fmt"
	"math"
	"math/rand/v2"
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
- In "missing", list every part of today's prompt that isn't in the drawing or can't be recognized (each thing, character, action or setting the prompt names), separated by commas. Leave it empty ("") when every part is there.
- In "prompt", say how well the doodle follows the prompt: "nailed" only when every part is there and done really well, "complete" when every part is there, "partial" when any part is missing, "missed" when most of the prompt is missing. Be strict: a great drawing that skips part of the prompt is "partial".
- In "effort", say how much effort went into the doodle. Answer "low" or "none" only when it's obvious the artist barely tried: a blank canvas, a single stray line, or a few careless scribbles. A simple, rough, clumsy, badly drawn or labelled doodle is still a real attempt, so answer "real". When in doubt, answer "real".
- If the image is blank or has nothing to do with the prompt, say so in character and score it low.

Stay fully in character. Reply only with the JSON you're asked for.`

// Effort is how hard the artist clearly tried.
const (
	EffortReal = "real" // A genuine attempt, however simple or rough
	EffortLow  = "low"  // Obviously rushed: a few careless scribbles
	EffortNone = "none" // Blank, a stray line, or nothing to do with drawing anything
)

// How well a doodle follows the day's prompt.
const (
	PromptNailed   = "nailed"   // Every part of the prompt is there, and done really well
	PromptComplete = "complete" // Every part of the prompt is there
	PromptPartial  = "partial"  // Some part of the prompt is missing
	PromptMissed   = "missed"   // Most of the prompt is missing
)

// promptBonuses are added to every score the judge gives (each criterion, or the overall score
// without criteria) for how well the doodle follows the prompt. Missing part of the prompt costs
// far more than nailing it earns, so a lovely drawing of half the prompt can't outscore a
// complete one.
var promptBonuses = map[string]float64{PromptNailed: 0.5, PromptComplete: 0, PromptPartial: -1.5, PromptMissed: -3}

// A rare swing: now and then a judge just loves or hates a doodle, and every score moves by
// some points, up or down. The code rolls it and applies it; the judge is only told how it
// feels, so its comment matches. It's what makes the very top and bottom scores possible.
// The tier and points are kept in the AI log.
const (
	SwingNone  = ""      // Most reviews
	SwingBoost = "boost" // Loves or hates it
	SwingSuper = "super" // Utterly obsessed with it, or deeply offended by it
)

// SwingTier is how often a kind of swing happens and how many points it moves every score.
type SwingTier struct {
	Kind     string
	Chance   float64
	Min, Max float64
}

// SwingTiers, rarest first. A review gets at most one.
var SwingTiers = []SwingTier{
	{Kind: SwingSuper, Chance: 0.01, Min: 3, Max: 4}, // 1 in 100
	{Kind: SwingBoost, Chance: 0.05, Min: 1, Max: 2}, // 1 in 20
}

// Swing is the swing a review got: its kind and the points added to every score (negative
// when the judge hates it). The zero Swing is no swing.
type Swing struct {
	Kind   string  `json:"kind"`
	Points float64 `json:"points"`
}

// rollSwing picks this review's swing, usually none. Tests swap it out.
var rollSwing = func() Swing {
	r := rand.Float64()
	for _, tier := range SwingTiers {
		if r >= tier.Chance {
			r -= tier.Chance
			continue
		}
		points := roundScore(tier.Min + rand.Float64()*(tier.Max-tier.Min))
		if rand.IntN(2) == 0 {
			points = -points
		}
		return Swing{Kind: tier.Kind, Points: points}
	}
	return Swing{}
}

// effortPenalties take this share off a doodle's overall score when it's clear little or no
// effort went into it. Players are never told: the criteria scores stay as the judge gave them.
var effortPenalties = map[string]float64{EffortLow: 0.25, EffortNone: 0.5}

// Request is everything a judge needs to review one doodle.
type Request struct {
	Personality models.AIPersonality
	Prompt      string // The day's prompt, e.g. "a reindeer stuck in a chimney"
	Image       []byte // The doodle, as a PNG
	// The swing added to every score because the judge loves or hates it; usually none.
	// Run rolls it.
	Swing Swing
}

// Verdict is a judge's review, checked and clamped to the 1..10 scale.
type Verdict struct {
	// Out of models.AIScoreMax, to one decimal: with criteria, their average
	Score    float64
	Criteria []models.AICriterionScore
	Comment  string
	// What the judge thought the drawing showed, before reading it as the prompt
	Seen string
	// How hard the artist clearly tried (EffortReal, EffortLow or EffortNone)
	Effort string
	// The share taken off the overall score for little or no effort, already applied to Score
	EffortPenalty float64
	// How well it follows the prompt (PromptNailed, PromptComplete, PromptPartial or PromptMissed)
	Prompt string
	// The parts of the prompt the judge found missing, or ""
	PromptMissing string
	// Added to every score for how well it follows the prompt, already applied
	PromptBonus float64
	// The swing added to every score because the judge loved or hated it, already applied
	Swing Swing
}

// SystemPrompt is the shared rules, the personality's character and how to score.
func SystemPrompt(p models.AIPersonality) string {
	var b strings.Builder
	fmt.Fprintf(&b, baseRules, MaxCommentWords)
	b.WriteString("\n\nWho you are:\n")
	b.WriteString(strings.TrimSpace(p.SystemPrompt))
	b.WriteString("\n\nScoring:\n")
	if len(p.Criteria) == 0 {
		fmt.Fprintf(&b, "Give the doodle one overall score from 1 (dreadful) to %d (masterpiece), to one decimal place (e.g. 6.5). Use the whole range.\n", models.AIScoreMax)
	} else {
		fmt.Fprintf(&b, "Score the doodle on each of these, by id, each from 1 (dreadful) to %d (masterpiece), to one decimal place (e.g. 6.5). Use the whole range.\n", models.AIScoreMax)
		for _, c := range p.Criteria {
			fmt.Fprintf(&b, "- %s: %q. %s\n", c.ID, c.Name, strings.TrimSpace(c.Description))
		}
		fmt.Fprintf(&b, "Also give an overall score from 1 to %d; it is replaced by the average of the scores above.\n", models.AIScoreMax)
	}
	fmt.Fprintf(&b, "A %d is almost never given: only a doodle so good it would stop you in your tracks. Most good doodles land between 6 and 8.\n", models.AIScoreMax)
	b.WriteString("Make your comment match your scores.")
	return b.String()
}

// UserPrompt introduces the doodle being judged, and how the judge feels about it when the
// review got a swing.
func UserPrompt(prompt string, swing Swing) string {
	return fmt.Sprintf("Today's prompt was: %q. Here is the doodle. Review it.", prompt) + swingFeeling(swing)
}

// swingFeeling tells the judge how it feels about a doodle that got a swing. It never says
// anything about scores: the code applies those.
func swingFeeling(swing Swing) string {
	loves := swing.Points > 0
	switch {
	case swing.Kind == SwingSuper && loves:
		return " This one hits you like nothing else ever has: you are utterly OBSESSED with it, it's the greatest doodle you've ever laid eyes on. Let that pour out of your comment, over the top, in your own voice."
	case swing.Kind == SwingSuper:
		return " This one offends you to your very core: it's the WORST doodle you've ever laid eyes on, and you take it personally. Let that pour out of your comment, over the top, in your own voice (still PG, and only about the drawing)."
	case swing.Kind == SwingBoost && loves:
		return " Something about this one just gets you: you LOVE it, more than you can explain. Let that gush through in your comment, in your own voice."
	case swing.Kind == SwingBoost:
		return " Something about this one just rubs you the wrong way: you HATE it, more than is fair. Let that show in your comment, in your own voice (still PG, and only about the drawing)."
	}
	return ""
}

// ResponseSchema is the JSON schema the model must answer with (OpenAI structured outputs,
// strict mode: every property required, no extras). The model answers in the order the
// properties are listed, so it says what it sees before scoring, and scores before commenting.
func ResponseSchema(p models.AIPersonality) map[string]any {
	properties := orderedObject{
		{"seen", map[string]any{"type": "string"}},
		{"missing", map[string]any{"type": "string"}},
		{"prompt", map[string]any{"type": "string", "enum": []string{PromptNailed, PromptComplete, PromptPartial, PromptMissed}}},
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
					{"score", map[string]any{"type": "number"}},
				},
				"required":             []string{"id", "score"},
				"additionalProperties": false,
			},
		}})
	}
	properties = append(properties,
		field{"score", map[string]any{"type": "number"}},
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
	Missing  string `json:"missing"`
	Prompt   string `json:"prompt"`
	Effort   string `json:"effort"`
	Criteria []struct {
		ID    string  `json:"id"`
		Score float64 `json:"score"`
	} `json:"criteria"`
	Score   float64 `json:"score"`
	Comment string  `json:"comment"`
}

// ParseVerdict reads the model's JSON answer and fits it to the personality. Every score the
// judge gives is rounded to one decimal and clamped to 1..10, and a criterion it skipped gets 5.
// Each score then moves by the bonus (or penalty) for how well the doodle follows the prompt,
// and by the swing, staying within 0..10. With criteria, the overall score is their average to
// one decimal place (so it can't disagree with them). Doodles that clearly took little or no
// effort then lose a share of the overall score.
func ParseVerdict(raw string, p models.AIPersonality, swing Swing) (Verdict, error) {
	var rv rawVerdict
	if err := json.Unmarshal([]byte(raw), &rv); err != nil {
		return Verdict{}, fmt.Errorf("judge's answer isn't valid JSON: %w", err)
	}

	comment := trimComment(rv.Comment)
	if comment == "" {
		return Verdict{}, fmt.Errorf("judge left an empty comment")
	}

	verdict := Verdict{
		Comment: comment, Seen: strings.TrimSpace(rv.Seen), Effort: EffortReal,
		Prompt: PromptComplete, PromptMissing: strings.TrimSpace(rv.Missing), Swing: swing,
	}
	if _, ok := effortPenalties[rv.Effort]; ok {
		verdict.Effort = rv.Effort
	}
	verdict.EffortPenalty = effortPenalties[verdict.Effort]
	if _, ok := promptBonuses[rv.Prompt]; ok {
		verdict.Prompt = rv.Prompt
	}
	verdict.PromptBonus = promptBonuses[verdict.Prompt]
	if len(p.Criteria) > 0 {
		verdict.Criteria, verdict.Score = scoreCriteria(rv, p, verdict.PromptBonus+swing.Points)
	} else {
		verdict.Score = adjustScore(rv.Score, verdict.PromptBonus+swing.Points)
	}
	if verdict.EffortPenalty > 0 {
		verdict.Score = math.Round(verdict.Score*(1-verdict.EffortPenalty)*10) / 10
	}
	return verdict, nil
}

// scoreCriteria fits the judge's criteria scores to the personality, moves each by the
// adjustment (prompt bonus plus swing), and averages them.
func scoreCriteria(rv rawVerdict, p models.AIPersonality, adjustment float64) ([]models.AICriterionScore, float64) {
	given := map[string]float64{}
	for _, c := range rv.Criteria {
		given[c.ID] = c.Score
	}
	var criteria []models.AICriterionScore
	total := 0.0
	for _, c := range p.Criteria {
		score, ok := given[c.ID]
		if !ok {
			score = models.AIScoreMax / 2
		}
		score = adjustScore(score, adjustment)
		criteria = append(criteria, models.AICriterionScore{AICriterion: c, Score: score})
		total += score
	}
	return criteria, math.Round(total/float64(len(p.Criteria))*10) / 10
}

// adjustScore fits a score the judge gave to 1..AIScoreMax at one decimal, then moves it by
// the adjustment, never past 0..AIScoreMax.
func adjustScore(given, adjustment float64) float64 {
	given = min(max(roundScore(given), 1), models.AIScoreMax)
	return min(max(roundScore(given+adjustment), 0), models.AIScoreMax)
}

func roundScore(score float64) float64 {
	return math.Round(score*10) / 10
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
