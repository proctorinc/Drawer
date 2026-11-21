package duel

import (
	"context"
	"drawer-service-backend/internal/ai"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"unicode/utf8"
)

// MaxGuesses is how many tries a guesser gets at a drawing.
const MaxGuesses = 3

// MaxGuessChars keeps a guess to a short phrase.
const MaxGuessChars = 80

// How well a word of the guess, or a keyword of the prompt, matched. Like Wordle: green, yellow, gray.
const (
	StatusHit   = "hit"   // Means the same thing
	StatusClose = "close" // Related, nearly there
	StatusMiss  = "miss"
)

// A keyword's credit (0..100) sets its status: the score and the colors always agree.
const (
	hitCredit   = 80
	closeCredit = 35
)

// maxNoteChars keeps a note to a few words under a tile.
const maxNoteChars = 60

// WordMark is how one word of the guess fared.
type WordMark struct {
	Text   string `json:"text"`
	Status string `json:"status"`
	Note   string `json:"note"`
}

// KeywordMark is how one keyword of the prompt fared. Keyword is hidden from the guesser
// (see Feedback.ForGuesser) until they've hit it or the round is over.
type KeywordMark struct {
	Keyword string `json:"keyword"`
	Status  string `json:"status"`
	Credit  int    `json:"credit"`
	Note    string `json:"note"`
}

// Feedback is the color-coded breakdown of one guess.
type Feedback struct {
	Words    []WordMark    `json:"words"`
	Keywords []KeywordMark `json:"keywords"`
}

// ForGuesser hides the keywords the guess didn't hit, so the feedback hints without
// giving the answer away.
func (f Feedback) ForGuesser() Feedback {
	out := Feedback{Words: f.Words, Keywords: make([]KeywordMark, len(f.Keywords))}
	for i, k := range f.Keywords {
		if k.Status != StatusHit {
			k.Keyword = ""
		}
		out.Keywords[i] = k
	}
	return out
}

// Result is a scored guess.
type Result struct {
	Score    int // 0..100: the share of the prompt's meaning the guess caught
	Exact    bool
	Feedback Feedback
	Note     string // One short line from the host about the guess
}

// GuessInput is everything needed to score a guess.
type GuessInput struct {
	Prompt   string
	Keywords []string
	Guess    string
	// Earlier guesses this round, so hints move on instead of repeating
	Previous []string
}

const scoreRules = `You score guesses in a pictionary-style drawing game between two friends. One drew a secret prompt in one minute; the other is guessing the prompt from the drawing, with three tries.

Score how much of the prompt's MEANING the guess caught, keyword by keyword. The exact words don't matter:
- Same meaning in other words is a full match: synonyms, plurals, other tenses, a more casual word ("pup" or "doggo" for "dog", "tub" for "bathtub", "melts" for "melting"). Give 90-100 credit and status "hit".
- Related but not quite it is close: the same kind of thing, the right idea but the wrong detail ("wolf" for "dog", "pool" for "bathtub", "dripping" for "melting", "bird" for "penguin"). Give 35-79 credit and status "close".
- Missing or unrelated: 0-34 credit and status "miss".
Each keyword can be matched by any part of the guess. Words of the guess that match nothing are "miss"; small filler words ("a", "the", "on", "in") are "miss" with an empty note.

Notes are tiny, at most 6 words, playful and helpful:
- For a hit, cheer it ("nailed it", "yep, that's a shark").
- For a close one, nudge toward it WITHOUT saying the keyword or an obvious synonym of it ("smaller and in the water", "think bath time").
- For a missed keyword, hint at what to look for in the drawing without saying it ("what's under them?", "check the background").
- Never reveal a keyword the guess didn't get, in any note.

Also write "note": one short line (at most 14 words) to the guesser about this guess, encouraging, never revealing a missed keyword.
Reply only with the JSON you're asked for.`

func scoreSchema(keywords []string) map[string]any {
	statuses := []string{StatusHit, StatusClose, StatusMiss}
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"words": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"index":  map[string]any{"type": "integer"},
						"status": map[string]any{"type": "string", "enum": statuses},
						"note":   map[string]any{"type": "string"},
					},
					"required":             []string{"index", "status", "note"},
					"additionalProperties": false,
				},
			},
			"keywords": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"keyword": map[string]any{"type": "string", "enum": keywords},
						"credit":  map[string]any{"type": "integer"},
						"note":    map[string]any{"type": "string"},
					},
					"required":             []string{"keyword", "credit", "note"},
					"additionalProperties": false,
				},
			},
			"note": map[string]any{"type": "string"},
		},
		"required":             []string{"words", "keywords", "note"},
		"additionalProperties": false,
	}
}

type rawScore struct {
	Words []struct {
		Index  int    `json:"index"`
		Status string `json:"status"`
		Note   string `json:"note"`
	} `json:"words"`
	Keywords []struct {
		Keyword string `json:"keyword"`
		Credit  int    `json:"credit"`
		Note    string `json:"note"`
	} `json:"keywords"`
	Note string `json:"note"`
}

// Score has the AI score a guess, falling back to plain word matching when there's no AI
// to ask (or it fails), so the game always goes on.
func Score(ctx context.Context, talker ai.Talker, in GuessInput) (Result, error) {
	words := guessWords(in.Guess)
	if talker == nil {
		return fallbackScore(in, words), errors.New("no AI to score with")
	}

	user, _ := json.Marshal(map[string]any{
		"prompt":          in.Prompt,
		"keywords":        in.Keywords,
		"guess":           in.Guess,
		"guessWords":      indexed(words),
		"previousGuesses": in.Previous,
	})
	raw, err := talker.Talk(ctx, scoreRules, string(user), "duel_guess_score", scoreSchema(in.Keywords))
	if err != nil {
		return fallbackScore(in, words), err
	}
	var rs rawScore
	if err := json.Unmarshal([]byte(raw), &rs); err != nil {
		return fallbackScore(in, words), fmt.Errorf("AI's score isn't valid JSON: %w", err)
	}
	return buildResult(in, words, rs), nil
}

func indexed(words []string) []map[string]any {
	out := make([]map[string]any, len(words))
	for i, w := range words {
		out[i] = map[string]any{"index": i, "word": w}
	}
	return out
}

// buildResult fits the AI's answer to the guess and keywords, so a skipped or made-up
// entry can't break the tiles, and works the score out from the keyword credits.
func buildResult(in GuessInput, words []string, rs rawScore) Result {
	res := Result{Note: trimNote(rs.Note, 100)}

	res.Feedback.Words = make([]WordMark, len(words))
	for i, w := range words {
		res.Feedback.Words[i] = WordMark{Text: w, Status: StatusMiss}
	}
	for _, w := range rs.Words {
		if w.Index < 0 || w.Index >= len(words) {
			continue
		}
		res.Feedback.Words[w.Index].Status = validStatus(w.Status)
		res.Feedback.Words[w.Index].Note = trimNote(w.Note, maxNoteChars)
	}

	given := map[string]struct {
		credit int
		note   string
	}{}
	for _, k := range rs.Keywords {
		given[k.Keyword] = struct {
			credit int
			note   string
		}{k.Credit, k.Note}
	}
	credits := make([]int, len(in.Keywords))
	res.Feedback.Keywords = make([]KeywordMark, len(in.Keywords))
	for i, kw := range in.Keywords {
		g := given[kw]
		credit := min(max(g.credit, 0), 100)
		credits[i] = credit
		res.Feedback.Keywords[i] = KeywordMark{Keyword: kw, Credit: credit, Status: statusFor(credit), Note: trimNote(g.note, maxNoteChars)}
	}

	res.Score = average(credits)
	if IsExact(in.Guess, in.Prompt) {
		res.Exact = true
		res.Score = 100
	}
	return res
}

func validStatus(s string) string {
	switch s {
	case StatusHit, StatusClose:
		return s
	}
	return StatusMiss
}

func statusFor(credit int) string {
	switch {
	case credit >= hitCredit:
		return StatusHit
	case credit >= closeCredit:
		return StatusClose
	}
	return StatusMiss
}

func average(credits []int) int {
	if len(credits) == 0 {
		return 0
	}
	total := 0
	for _, c := range credits {
		total += c
	}
	return int(math.Round(float64(total) / float64(len(credits))))
}

var nonWord = regexp.MustCompile(`[^\p{L}\p{N}' ]+`)

// guessWords splits a guess into the words shown as tiles.
func guessWords(guess string) []string {
	return strings.Fields(nonWord.ReplaceAllString(guess, " "))
}

var fillers = map[string]bool{"a": true, "an": true, "the": true, "of": true, "on": true, "in": true, "at": true, "with": true, "to": true, "its": true, "and": true}

// stem is a rough stem, enough for "sharks"/"shark" and "melting"/"melt" to agree.
func stem(word string) string {
	w := strings.ToLower(strings.Trim(word, "'"))
	for _, suffix := range []string{"ing", "es", "s", "ed"} {
		if len(w) > len(suffix)+2 && strings.HasSuffix(w, suffix) {
			return strings.TrimSuffix(w, suffix)
		}
	}
	return w
}

func normalize(text string) []string {
	var out []string
	for _, w := range guessWords(strings.ToLower(text)) {
		if !fillers[w] {
			out = append(out, stem(w))
		}
	}
	return out
}

// IsExact is the bonus: the guess is the prompt, give or take articles, plurals and punctuation.
func IsExact(guess, prompt string) bool {
	g, p := normalize(guess), normalize(prompt)
	return len(g) > 0 && strings.Join(g, " ") == strings.Join(p, " ")
}

// fallbackScore matches words without understanding them: a keyword is hit when all its
// words are in the guess, close when some are.
func fallbackScore(in GuessInput, words []string) Result {
	guessStems := map[string]bool{}
	for _, w := range words {
		guessStems[stem(w)] = true
	}
	keywordStems := map[string]bool{}

	res := Result{Note: "the AI's napping, so this is a plain word match"}
	credits := make([]int, len(in.Keywords))
	for i, kw := range in.Keywords {
		parts := normalize(kw)
		found := 0
		for _, p := range parts {
			keywordStems[p] = true
			if guessStems[p] {
				found++
			}
		}
		credit := 0
		if len(parts) > 0 {
			credit = found * 100 / len(parts)
		}
		if credit > 0 && credit < 100 {
			credit = max(credit, closeCredit)
		}
		credits[i] = credit
		res.Feedback.Keywords = append(res.Feedback.Keywords, KeywordMark{Keyword: kw, Credit: credit, Status: statusFor(credit)})
	}
	for _, w := range words {
		status := StatusMiss
		if keywordStems[stem(w)] {
			status = StatusHit
		}
		res.Feedback.Words = append(res.Feedback.Words, WordMark{Text: w, Status: status})
	}
	res.Score = average(credits)
	if IsExact(in.Guess, in.Prompt) {
		res.Exact = true
		res.Score = 100
	}
	return res
}

func trimNote(note string, limit int) string {
	note = strings.Trim(strings.Join(strings.Fields(note), " "), `"`)
	if utf8.RuneCountInString(note) <= limit {
		return note
	}
	return strings.TrimRight(string([]rune(note)[:limit]), ",;:- ") + "…"
}
