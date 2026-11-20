package ai

import (
	"context"
	"drawer-service-backend/internal/db/models"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

// An intro is the judge asking you for the day's doodle when you open the app, RPG style:
// a greeting, the ask (with a reason only they would have), and a promise to rate it.

// Intro line limits: each fits a speech bubble on a phone without scrolling.
const (
	minIntroLines    = 2
	maxIntroLines    = 3
	maxIntroLineChar = 160
)

const introRules = `You are a character in a daily drawing game between friends. Each day everyone draws the same prompt, and you rate the doodles.

The player just opened the game. Greet them and ask them to draw today's prompt for you, in your own voice, like a quest-giver in a video game.

Write 2 or 3 short lines of dialogue, shown one speech bubble at a time:
1. A short greeting in character.
2. Ask them to draw you today's prompt, using its exact words: %q. Add a quick, funny reason why you need it that fits your character (a scheme, a grudge, a craving, a memory). Make it specific to this prompt.
3. Tell them you'll rate their drawing when they're done, in character.

Rules:
- Each line at most 20 words. Plain text, no emoji, no stage directions, no quotation marks around lines.
- Keep it PG. Never mention AI, the app, phones, brushes, colors or scores.
- Reply only with the JSON you're asked for.`

// IntroSystemPrompt is the intro rules for this prompt, then who the judge is.
func IntroSystemPrompt(p models.AIPersonality, prompt string) string {
	var b strings.Builder
	fmt.Fprintf(&b, introRules, prompt)
	b.WriteString("\n\nWho you are:\n")
	b.WriteString(strings.TrimSpace(p.SystemPrompt))
	return b.String()
}

// IntroSchema is the JSON the model answers an intro with.
func IntroSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"lines": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		},
		"required":             []string{"lines"},
		"additionalProperties": false,
	}
}

var leadingArticle = regexp.MustCompile(`^(a|an|the)\s+`)

// promptCore is the prompt without its article, lowercased: "A goalie" → "goalie".
func promptCore(prompt string) string {
	return leadingArticle.ReplaceAllString(strings.ToLower(strings.TrimSpace(prompt)), "")
}

// ParseIntro checks the model's lines: the right number, not too long, and actually asking
// for today's prompt.
func ParseIntro(raw, prompt string) ([]string, error) {
	var answer struct {
		Lines []string `json:"lines"`
	}
	if err := json.Unmarshal([]byte(raw), &answer); err != nil {
		return nil, fmt.Errorf("unreadable intro: %w", err)
	}
	lines := make([]string, 0, len(answer.Lines))
	for _, line := range answer.Lines {
		line = strings.Trim(strings.TrimSpace(line), `"“”`)
		if line == "" {
			continue
		}
		if utf8.RuneCountInString(line) > maxIntroLineChar {
			return nil, errors.New("intro line too long")
		}
		lines = append(lines, line)
	}
	if len(lines) < minIntroLines || len(lines) > maxIntroLines {
		return nil, fmt.Errorf("intro has %d lines", len(lines))
	}
	if !strings.Contains(strings.ToLower(strings.Join(lines, " ")), promptCore(prompt)) {
		return nil, errors.New("intro never asks for the prompt")
	}
	return lines, nil
}

// StockIntro is what a judge says when the model can't be asked.
func StockIntro(prompt string) []string {
	return []string{
		"Ah, there you are! Just the doodler I was looking for.",
		fmt.Sprintf("I need you to draw me %s. Don't ask why. Just trust me.", strings.ToLower(strings.TrimSpace(prompt))),
		"Bring it back when you're done and I'll give it a proper rating.",
	}
}

// How long the app waits on the model for an intro before using the stock one
const introTimeout = 12 * time.Second

// After a failed intro, how long before the model is asked again
const introRetryAfter = 10 * time.Minute

type introKey struct {
	day, personalityID, prompt, systemPrompt string
}

type introEntry struct {
	ready   chan struct{}
	lines   []string
	expires time.Time // Zero for a written intro, which lasts the day
}

// Intros are written once per judge per day and shared by everyone. They live in memory:
// a restart just writes a fresh one.
var intros = struct {
	sync.Mutex
	byKey map[introKey]*introEntry
}{byKey: map[introKey]*introEntry{}}

// TodaysIntro returns the judge's lines asking for today's prompt, writing them the first
// time they're asked for (callers at the same moment share the one request). Falls back to
// the stock lines when the provider can't talk or the model fails.
func TodaysIntro(ctx context.Context, provider Provider, p models.AIPersonality, day, prompt string) []string {
	key := introKey{day, p.ID, prompt, p.SystemPrompt}

	intros.Lock()
	// Only today's are worth keeping
	for k := range intros.byKey {
		if k.day != day {
			delete(intros.byKey, k)
		}
	}
	entry, ok := intros.byKey[key]
	if ok && !entry.expires.IsZero() && isClosed(entry.ready) && time.Now().After(entry.expires) {
		ok = false
	}
	if !ok {
		entry = &introEntry{ready: make(chan struct{})}
		intros.byKey[key] = entry
		go writeIntro(entry, provider, p, prompt)
	}
	intros.Unlock()

	select {
	case <-entry.ready:
		return entry.lines
	case <-ctx.Done():
		return StockIntro(prompt)
	}
}

func isClosed(ch chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}

// writeIntro asks the model for the intro, on its own clock so one impatient caller
// leaving doesn't waste it for everyone else.
func writeIntro(entry *introEntry, provider Provider, p models.AIPersonality, prompt string) {
	defer close(entry.ready)

	talker, ok := provider.(Talker)
	if !ok {
		entry.lines = StockIntro(prompt)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), introTimeout)
	defer cancel()

	raw, err := talker.Talk(ctx, IntroSystemPrompt(p, prompt), "The player is here.", "judge_intro", IntroSchema())
	if err == nil {
		entry.lines, err = ParseIntro(raw, prompt)
	}
	if err != nil {
		log.Printf("AI judge: %s couldn't write an intro for %q: %v", p.Name, prompt, err)
		entry.lines = StockIntro(prompt)
		entry.expires = time.Now().Add(introRetryAfter)
	}
}
