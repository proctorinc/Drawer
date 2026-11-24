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

// MaxAnswerChars keeps one blank's answer to a word or three.
const MaxAnswerChars = 30

// How well a word of the guess, or a keyword of the prompt, matched. Like Wordle: green, yellow, gray.
const (
	StatusHit   = "hit"   // Means the same thing
	StatusClose = "close" // Related, nearly there
	StatusMiss  = "miss"
)

// A keyword's credit (0..100) sets its status: the score and the colors always agree.
// A yellow is worth well under a green, so a round with yellows left in it doesn't
// score like one that's solved.
const (
	hitCredit   = 85
	closeCredit = 20
	// The most a close answer can earn
	closeMax = 50
	// The most an answer that's only part of the keyword can earn: "pirate" or "ship"
	// for "pirate ship", "snow" for "snowman"
	partialCredit = 40
)

// WordMark is how one word of the guess fared.
type WordMark struct {
	Text   string `json:"text"`
	Status string `json:"status"`
	Note   string `json:"note"`
}

// How a close answer relates to the keyword, so a yellow says which way to go.
const (
	RelationBroader  = "broader"  // The answer is too general ("animal" for "dog")
	RelationNarrower = "narrower" // Too specific ("poodle" for "dog")
	RelationSimilar  = "similar"  // The same kind of thing, but another one ("wolf" for "dog")
	RelationRelated  = "related"  // Goes with it, but isn't it ("bath" for "sauna")
	RelationPart     = "part"     // A piece of it ("sail" for "pirate ship")
	RelationOpposite = "opposite" // The other way round ("freezing" for "melting")
	RelationNone     = ""
)

// Where to look in the drawing, the only hint a missed or close keyword gets. The scorer
// never sees the drawing, and a quick sketch can be rough, so a hint only says where to
// look, never what's there or what the answer is like.
var lookLines = map[string]string{
	"setting": "look at the setting",
	"action":  "look at what's happening",
	"shape":   "look at the shape",
	"around":  "look at what's around it",
	"details": "look closer at the details",
	"size":    "look at the size of things",
	"whole":   "look at the whole picture",
}

var looks = []string{"setting", "action", "shape", "around", "details", "size", "whole", "none"}

func lookLine(look string) string {
	if line, ok := lookLines[look]; ok {
		return line
	}
	return lookLines["details"]
}

var relations = []string{RelationBroader, RelationNarrower, RelationSimilar, RelationRelated, RelationPart, RelationOpposite, "none"}

// KeywordMark is how one keyword of the prompt fared. Keyword is hidden from the guesser
// (see Feedback.ForGuesser) until they've hit it or the round is over.
type KeywordMark struct {
	Keyword string `json:"keyword"`
	Status  string `json:"status"`
	Credit  int    `json:"credit"`
	Note    string `json:"note"`
	// What the guesser put in this keyword's blank
	Answer string `json:"answer,omitempty"`
	// For a close one, how the answer relates to the keyword
	Relation string `json:"relation,omitempty"`
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
	// The whole guess as a sentence
	Guess string
	// What went in each keyword's blank, by keyword. Nil for a free-text guess.
	Answers []string
	// Keywords already hit by an earlier guess: they stay hit, as they were
	Locked map[int]KeywordMark
	// Earlier guesses this round, so hints move on instead of repeating
	Previous []string
}

const scoreRules = `You score guesses in a pictionary-style drawing game between two friends. One drew a secret prompt in one minute; the other is guessing the prompt from the drawing, with three tries.

The guesser fills in the prompt like a fill-in-the-blank sentence: "answers" has what they put in each keyword's blank (same order as "keywords"). Score each keyword ONLY by its own answer. (With no "answers", the keyword can be matched by any part of "guess".)

Score how much of each keyword's MEANING the answer caught. The exact words don't matter:
- "hit": it means the same thing in other words: synonyms, plurals, other tenses, a casual word ("pup" or "doggo" for "dog", "tub" for "bathtub", "melts" for "melting"). Credit 85-100. A hit shows the guesser the keyword, so only call it a hit when they've really got the whole thing; when in doubt, it's "close".
- "close": related but not it. Credit 20-50. Pick the "relation" that says how the answer is off:
  - "broader": too general ("animal" for "dog", "boat" for "pirate ship")
  - "narrower": too specific ("poodle" for "dog")
  - "similar": the same kind of thing, but a different one ("wolf" for "dog", "pool" for "bathtub", "wasteland" for "desert")
  - "related": goes with it but isn't it ("bath" for "sauna", "cactus" for "desert")
  - "part": a piece of it ("sail" for "pirate ship")
  - "opposite": the other way round ("freezing" for "melting")
- "miss": missing or unrelated. Credit 0-19, relation "none".
For a hit or a miss, the relation is "none".

A keyword needs ALL of its meaning to be a hit. An answer that is only some of it is never a hit:
- Only the general thing is "close", relation "broader": "ship" for "pirate ship", "bear" for "polar bear", "hat" for "top hat".
- Only the describing part, or a piece of a compound word, is "close", relation "part": "pirate" for "pirate ship", "polar" for "polar bear", "snow" for "snowman", "light" for "lighthouse".

For each keyword that isn't a hit, pick "look": where in the drawing to look again, one of "setting" (where it happens), "action" (what's happening), "shape" (the shape of the thing), "around" (what's around it), "details", "size", or "whole" (the whole picture). For a hit, "look" is "none". You can't see the drawing, so don't guess at what's in it.
NEVER write a keyword the guesser hasn't hit, or an obvious synonym of it, anywhere.

"words" marks each word of "guessWords" (send [] when there are none): "hit", "close" or "miss", with an empty note; small filler words ("a", "the", "on", "in") are "miss" with an empty note.

Also write "note": a few encouraging words (at most 8), saying nothing about what the answer is.
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
						"keyword":  map[string]any{"type": "string", "enum": keywords},
						"status":   map[string]any{"type": "string", "enum": statuses},
						"relation": map[string]any{"type": "string", "enum": relations},
						"credit":   map[string]any{"type": "integer"},
						"look":     map[string]any{"type": "string", "enum": looks},
					},
					"required":             []string{"keyword", "status", "relation", "credit", "look"},
					"additionalProperties": false,
				},
			},
			"note": map[string]any{"type": "string"},
		},
		"required":             []string{"words", "keywords", "note"},
		"additionalProperties": false,
	}
}

type rawKeyword struct {
	Keyword  string `json:"keyword"`
	Status   string `json:"status"`
	Relation string `json:"relation"`
	Credit   int    `json:"credit"`
	Look     string `json:"look"`
}

type rawScore struct {
	Words []struct {
		Index  int    `json:"index"`
		Status string `json:"status"`
		Note   string `json:"note"`
	} `json:"words"`
	Keywords []rawKeyword `json:"keywords"`
	Note     string       `json:"note"`
}

// Score has the AI score a guess, falling back to plain word matching when there's no AI
// to ask (or it fails), so the game always goes on.
func Score(ctx context.Context, talker ai.Talker, in GuessInput) (Result, error) {
	words := guessWords(in.Guess)
	if in.Answers != nil {
		// The answers are scored blank by blank; the sentence's words aren't marked
		words = nil
	}
	if talker == nil {
		return fallbackScore(in, words), errors.New("no AI to score with")
	}

	payload := map[string]any{
		"prompt":          in.Prompt,
		"keywords":        in.Keywords,
		"guess":           in.Guess,
		"guessWords":      indexed(words),
		"previousGuesses": in.Previous,
	}
	if in.Answers != nil {
		payload["answers"] = in.Answers
	}
	user, _ := json.Marshal(payload)
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
		res.Feedback.Words[w.Index].Note = ""
	}

	given := map[string]rawKeyword{}
	for _, k := range rs.Keywords {
		given[k.Keyword] = k
	}
	res.Feedback.Keywords = make([]KeywordMark, len(in.Keywords))
	for i, kw := range in.Keywords {
		g, ok := given[kw]
		status := validStatus(g.Status)
		if !ok {
			status = StatusMiss
		}
		mark := KeywordMark{Keyword: kw, Status: status, Credit: creditFor(status, g.Credit)}
		if status != StatusHit {
			mark.Note = lookLine(g.Look)
		}
		if status == StatusClose {
			mark.Relation = validRelation(g.Relation)
		}
		res.Feedback.Keywords[i] = mark
	}
	finish(&res, in)
	return res
}

// finish applies what every scored guess shares: hits from earlier guesses stay hit, the
// answers go on their keywords, notes can't name a keyword that's still hidden, and the
// score is worked out from the credits.
func finish(res *Result, in GuessInput) {
	for i := range res.Feedback.Keywords {
		mark := &res.Feedback.Keywords[i]
		if in.Answers != nil && i < len(in.Answers) {
			mark.Answer = in.Answers[i]
			// Only part of the keyword is never it: "ship" or "pirate" for "pirate ship",
			// "snow" for "snowman"
			// It only ever pulls a score down, never lifts a miss: the compound check is
			// a rough one ("cat" looks like part of "category")
			if relation, ok := partOf(mark.Answer, in.Keywords[i]); ok && mark.Status != StatusMiss {
				mark.Status, mark.Relation = StatusClose, relation
				mark.Credit = min(max(mark.Credit, closeCredit), partialCredit)
				if mark.Note == "" {
					mark.Note = lookLine("details")
				}
			}
		}
		if locked, ok := in.Locked[i]; ok && locked.Credit >= mark.Credit {
			locked.Keyword, locked.Status, locked.Relation = in.Keywords[i], StatusHit, RelationNone
			if locked.Answer == "" {
				locked.Answer = mark.Answer
			}
			*mark = locked
		}
	}

	var hidden []string
	for _, mark := range res.Feedback.Keywords {
		if mark.Status != StatusHit {
			hidden = append(hidden, mark.Keyword)
		}
	}
	for i := range res.Feedback.Keywords {
		mark := &res.Feedback.Keywords[i]
		if mark.Status != StatusHit && names(mark.Note, hidden) {
			mark.Note = ""
		}
	}
	for i := range res.Feedback.Words {
		if names(res.Feedback.Words[i].Note, hidden) {
			res.Feedback.Words[i].Note = ""
		}
	}
	if names(res.Note, hidden) {
		res.Note = "Keep going!"
	}

	credits := make([]int, len(res.Feedback.Keywords))
	allHit := len(credits) > 0
	for i, mark := range res.Feedback.Keywords {
		credits[i] = mark.Credit
		allHit = allHit && mark.Status == StatusHit
	}
	res.Score = average(credits)
	if IsExact(in.Guess, in.Prompt) || (in.Answers != nil && answersExact(in.Answers, in.Keywords)) {
		res.Exact = true
		res.Score = 100
	} else if allHit {
		// Every part found: the round's done, whatever the credits add up to
		res.Score = 100
	}
}

func answersExact(answers, keywords []string) bool {
	for i, kw := range keywords {
		if i >= len(answers) || strings.Join(normalize(answers[i]), " ") != strings.Join(normalize(kw), " ") {
			return false
		}
	}
	return len(keywords) > 0
}

// partOf reports whether the answer is only part of the keyword, and how: the main
// thing alone is "broader" ("ship" for "pirate ship", "man" for "snowman"), anything
// else is "part" ("pirate" for "pirate ship", "snow" for "snowman").
func partOf(answer, keyword string) (string, bool) {
	kw := normalize(keyword)
	got := normalize(answer)
	if len(kw) == 0 || len(got) == 0 {
		return "", false
	}
	head := func(words []string) string { return words[len(words)-1] }

	// Some, but not all, of a multi-word keyword's words
	if len(got) < len(kw) {
		want := map[string]bool{}
		for _, w := range kw {
			want[w] = true
		}
		all := true
		for _, w := range got {
			all = all && want[w]
		}
		if all {
			if len(got) == 1 && got[0] == head(kw) {
				return RelationBroader, true
			}
			return RelationPart, true
		}
	}

	// A piece of a compound word: "snow" for "snowman", "house" for "lighthouse"
	whole, piece := strings.Join(kw, ""), strings.Join(got, "")
	// (both halves real pieces, so "ice" in "rice" doesn't count)
	if len(piece) >= 3 && len(whole)-len(piece) >= 3 {
		if strings.HasSuffix(whole, piece) {
			return RelationBroader, true
		}
		if strings.HasPrefix(whole, piece) {
			return RelationPart, true
		}
	}
	return "", false
}

// names reports whether a note gives away one of the hidden keywords, by any of its words.
func names(note string, hidden []string) bool {
	if note == "" {
		return false
	}
	noteWords := wordsOf(note)
	for _, kw := range hidden {
		for _, part := range wordsOf(kw) {
			if len(part.text) < 3 || fillers[part.text] {
				continue
			}
			for _, w := range noteWords {
				if sameWord(w.text, part.text) {
					return true
				}
			}
		}
	}
	return false
}

// creditFor keeps the credit inside its status's band, so the score and colors agree.
func creditFor(status string, credit int) int {
	switch status {
	case StatusHit:
		return min(max(credit, hitCredit), 100)
	case StatusClose:
		return min(max(credit, closeCredit), closeMax)
	}
	return min(max(credit, 0), closeCredit-1)
}

func validRelation(r string) string {
	for _, known := range relations {
		if r == known && r != "none" {
			return r
		}
	}
	return RelationRelated
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
// words are in its answer (or, for a free-text guess, anywhere in the guess), close when
// some are.
func fallbackScore(in GuessInput, words []string) Result {
	guessStems := map[string]bool{}
	for _, w := range guessWords(in.Guess) {
		guessStems[stem(w)] = true
	}
	keywordStems := map[string]bool{}

	res := Result{Note: "Keep going!"}
	res.Feedback.Words = []WordMark{}
	for i, kw := range in.Keywords {
		have := guessStems
		if in.Answers != nil {
			have = map[string]bool{}
			if i < len(in.Answers) {
				for _, w := range guessWords(in.Answers[i]) {
					have[stem(w)] = true
				}
			}
		}
		parts := normalize(kw)
		found := 0
		for _, p := range parts {
			keywordStems[p] = true
			if have[p] {
				found++
			}
		}
		credit := 0
		if len(parts) > 0 {
			credit = found * 100 / len(parts)
		}
		if credit > 0 && credit < 100 {
			credit = min(max(credit, closeCredit), closeMax)
		}
		mark := KeywordMark{Keyword: kw, Credit: credit, Status: statusFor(credit)}
		if mark.Status != StatusHit {
			mark.Note = lookLine("details")
		}
		if mark.Status == StatusClose {
			mark.Relation = RelationBroader
		}
		res.Feedback.Keywords = append(res.Feedback.Keywords, mark)
	}
	for _, w := range words {
		status := StatusMiss
		if keywordStems[stem(w)] {
			status = StatusHit
		}
		res.Feedback.Words = append(res.Feedback.Words, WordMark{Text: w, Status: status})
	}
	finish(&res, in)
	return res
}

var statusPrefix = regexp.MustCompile(`(?i)^(hit|close|miss)\s*:\s*`)

func trimNote(note string, limit int) string {
	note = strings.Trim(strings.Join(strings.Fields(note), " "), `"`)
	note = statusPrefix.ReplaceAllString(note, "")
	if utf8.RuneCountInString(note) <= limit {
		return note
	}
	return strings.TrimRight(string([]rune(note)[:limit]), ",;:- ") + "…"
}
