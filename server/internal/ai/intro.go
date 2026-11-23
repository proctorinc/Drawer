package ai

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"regexp"
	"slices"
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

// stolenIntroRules are the intro rules for a judge that scores backwards (the Grinch): he's
// stolen the day, and tempts the player to draw the prompt badly, to help ruin it. He comes
// back every week and remembers whose side each player took last time, so the model writes
// the shared opening once and the final ask once per history (see IntroHistory); each player
// hears the ask that fits them.
const stolenIntroRules = `You are a villain in a daily drawing game between friends, set during its Christmas event, Doodlemas. Each day everyone draws the same prompt, and you rate the doodles. You steal Doodlemas once a week.

The player just opened the game, and you've STOLEN today's Doodlemas. Make a dramatic villain's entrance and tempt them to help you ruin it, like a villain recruiting a henchman in a video game.

Write the opening: 2 short lines of dialogue, shown one speech bubble at a time, the same for every player:
1. A dramatic announcement, in character, that you've stolen Doodlemas for the day.
2. Tempt them to draw you today's prompt, using its exact words: %q, but to draw it BADLY: sloppy, lazy, gloomy or plain wrong. Give a quick, specific, scheming reason it helps your plot to ruin Doodlemas.

Then write your final line, the ask, five ways. You remember what each player did on your last visit, and they'll hear the one that fits them. Each asks a yes-or-no question about joining (or sticking with) your plot to ruin Doodlemas, with the question ending in a question mark (they answer with a button). Be persuasive, in your sneaky, grinchy way:
- "first": a new face. Ask point blank whether they'll join your plot, and warn what happens to anyone who draws it nicely.
- "loyal": last time they joined you and kept their word, drawing it badly. Grudgingly praise their loyalty and ask if they'll stay loyal today.
- "traitor": last time they swore to join you, then drew it nicely anyway. Remind them of the betrayal, and persuade them to come back and prove themselves.
- "rebel": last time they refused you and drew it nicely. Tempt them, sneakily, to switch sides this time.
- "secretFan": last time they refused you, yet drew it badly anyway. Call them out as a secret accomplice and ask if they'll finally admit it and join you.

Finally, write your reply to their answer, for each of those five: "yes" when they choose your side, "no" when they refuse. It's the last thing you say before they go off to draw, so react in character to who they are and what they just chose: gleeful, suspicious, outraged, wounded, smug. Keep each reply its own, no two alike.

Rules:
- Opening lines and replies at most 20 words each; each ask at most 25 words. Plain text, no emoji, no stage directions, no quotation marks around lines.
- Keep it PG. Never mention AI, the app, phones, brushes, colors or scores.
- Reply only with the JSON you're asked for.`

// IntroHistory is whose side a player took the last time a judge that scores backwards
// visited, and whether their drawing kept their word: it picks the ask they hear.
type IntroHistory string

const (
	HistoryFirst     IntroHistory = "first"     // Never answered him before
	HistoryLoyal     IntroHistory = "loyal"     // Joined, and drew it badly (or didn't draw)
	HistoryTraitor   IntroHistory = "traitor"   // Joined, then drew it well
	HistoryRebel     IntroHistory = "rebel"     // Refused, and drew it well (or didn't draw)
	HistorySecretFan IntroHistory = "secretFan" // Refused, then drew it badly anyway
)

// introAsks is the order a stolen intro's asks are kept in, after its opening lines.
var introAsks = []IntroHistory{HistoryFirst, HistoryLoyal, HistoryTraitor, HistoryRebel, HistorySecretFan}

// IntroReplies is what a judge that scores backwards says after a player answers his ask,
// before they go off to draw.
type IntroReplies struct {
	Yes string `json:"yes"` // They chose his side
	No  string `json:"no"`  // They refused
}

// stolenOpeningLines is how many lines every player hears before their ask.
const stolenOpeningLines = 2

// maxAskChars backs up the ask's word limit.
const maxAskChars = 200

// HistoryFor reads a player's last visit from the Grinch: what they promised (nil if they
// never answered) and his score for what they drew that day (nil if they didn't draw). A
// score of 5 or more means they drew it more badly than well.
func HistoryFor(joined *bool, score *float64) IntroHistory {
	switch {
	case joined == nil:
		return HistoryFirst
	case *joined && (score == nil || *score >= 5):
		return HistoryLoyal
	case *joined:
		return HistoryTraitor
	case score != nil && *score >= 5:
		return HistorySecretFan
	default:
		return HistoryRebel
	}
}

// stolenKeptLines is how long a stolen intro is as it's kept: the opening, an ask per history
// (introAsks order), then a yes and a no reply per history (the same order).
var stolenKeptLines = stolenOpeningLines + len(introAsks)*3

// StolenIntro picks a player's part of a stolen intro as it's kept: the opening and the ask
// for their history, and his replies to their answer. Anything else comes back as it is, with
// no replies.
func StolenIntro(kept []string, history IntroHistory) ([]string, *IntroReplies) {
	if len(kept) != stolenKeptLines {
		return kept, nil
	}
	i := slices.Index(introAsks, history)
	if i < 0 {
		i = 0
	}
	lines := append(slices.Clone(kept[:stolenOpeningLines]), kept[stolenOpeningLines+i])
	r := stolenOpeningLines + len(introAsks) + i*2
	return lines, &IntroReplies{Yes: kept[r], No: kept[r+1]}
}

// IntroSystemPrompt is the intro rules for this prompt, then who the judge is.
func IntroSystemPrompt(p models.AIPersonality, prompt, day string) string {
	var b strings.Builder
	rules := introRules
	if p.ScoresBackwards {
		rules = stolenIntroRules
	}
	fmt.Fprintf(&b, rules, prompt)
	b.WriteString(introOccasion(p, day))
	b.WriteString("\n\nWho you are:\n")
	b.WriteString(strings.TrimSpace(p.SystemPrompt))
	return b.String()
}

// IntroSchemaFor is the JSON a judge answers its intro with: lines, plus the asks for a judge
// that scores backwards.
func IntroSchemaFor(p models.AIPersonality) map[string]any {
	if !p.ScoresBackwards {
		return IntroSchema()
	}
	asks := orderedObject{}
	for _, h := range introAsks {
		asks = append(asks, field{string(h), map[string]any{"type": "string"}})
	}
	reply := strictObject(orderedObject{{"yes", map[string]any{"type": "string"}}, {"no", map[string]any{"type": "string"}}})
	replies := orderedObject{}
	for _, h := range introAsks {
		replies = append(replies, field{string(h), reply})
	}
	return strictObject(orderedObject{
		{"lines", map[string]any{"type": "array", "items": map[string]any{"type": "string"}}},
		{"asks", strictObject(asks)},
		{"replies", strictObject(replies)},
	})
}

// ParseIntroFor is ParseIntro for any judge. A stolen intro comes back as it's kept (see
// stolenKeptLines and StolenIntro).
func ParseIntroFor(raw string, p models.AIPersonality, prompt string) ([]string, error) {
	if !p.ScoresBackwards {
		return ParseIntro(raw, prompt)
	}
	var answer struct {
		Lines   []string                `json:"lines"`
		Asks    map[string]string       `json:"asks"`
		Replies map[string]IntroReplies `json:"replies"`
	}
	if err := json.Unmarshal([]byte(raw), &answer); err != nil {
		return nil, fmt.Errorf("unreadable intro: %w", err)
	}
	kept := []string{}
	for _, line := range answer.Lines {
		if line = strings.Trim(strings.TrimSpace(line), `"“”`); line != "" {
			if utf8.RuneCountInString(line) > maxIntroLineChar {
				return nil, errors.New("intro line too long")
			}
			kept = append(kept, line)
		}
	}
	if len(kept) != stolenOpeningLines {
		return nil, fmt.Errorf("stolen intro opens with %d lines", len(kept))
	}
	if !strings.Contains(strings.ToLower(strings.Join(kept, " ")), promptCore(prompt)) {
		return nil, errors.New("intro never asks for the prompt")
	}
	for _, h := range introAsks {
		ask := strings.Trim(strings.TrimSpace(answer.Asks[string(h)]), `"“”`)
		switch {
		case ask == "":
			return nil, fmt.Errorf("intro has no %s ask", h)
		case utf8.RuneCountInString(ask) > maxAskChars:
			return nil, fmt.Errorf("intro's %s ask is too long", h)
		case !strings.Contains(ask, "?"):
			return nil, fmt.Errorf("intro's %s ask doesn't ask", h)
		}
		kept = append(kept, ask)
	}
	for _, h := range introAsks {
		reply := answer.Replies[string(h)]
		for _, line := range []string{reply.Yes, reply.No} {
			line = strings.Trim(strings.TrimSpace(line), `"“”`)
			if line == "" || utf8.RuneCountInString(line) > maxIntroLineChar {
				return nil, fmt.Errorf("intro's %s replies are missing or too long", h)
			}
			kept = append(kept, line)
		}
	}
	return kept, nil
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

// StockIntroFor is StockIntro, or the stolen-Doodlemas pitch for a judge that scores backwards.
func StockIntroFor(p models.AIPersonality, prompt, day string) []string {
	if !p.ScoresBackwards {
		return StockIntro(prompt)
	}
	// Kept like a written one: the opening, then an ask per history (introAsks)
	return []string{
		stolenOpening(day),
		fmt.Sprintf("Draw me %s. Badly. The uglier it is, the faster this miserable holiday falls apart.", strings.ToLower(strings.TrimSpace(prompt))),
		"So. Will you join my plot to ruin Doodlemas? Draw it nicely, and you'll answer to me.",
		"You helped me last time, my loyal little accomplice. Will you stay loyal and ruin it all again?",
		"Last time you swore to help me, then drew it NICELY. Traitor. Will you come crawling back and prove yourself?",
		"You defied me last time. Bah. But think how fun it'd be to wreck it together. Will you join me now?",
		"You refused me last time, then drew a glorious mess anyway. Admit it. Will you finally join me properly?",
		// Replies, yes then no, per history
		"Ha! A new henchman. Now go make me something truly hideous.",
		"Bah! Fine. Draw your precious nice picture. I'll be watching, and fuming.",
		"My faithful accomplice. Go on, ruin it beautifully. I mean horribly.",
		"You're QUITTING me? After everything? Go, then. See if I care. I care.",
		"Hmph. I'll believe it when I see the mess. Don't you dare draw it nicely.",
		"Of course. Once a traitor, always a do-gooder. Go spoil my day, then.",
		"Finally seeing sense! Go on, make it gloriously awful.",
		"STILL?! Stubborn little do-gooder. Fine. Go annoy me with your nice drawing.",
		"I KNEW it. Welcome, my not-so-secret accomplice. Now go wreck it.",
		"Deny it all you like. I've seen your scribbles. Prove me wrong, then.",
	}
}

// stolenOpening is the Grinch's stock first line: on Christmas Eve, his last chance.
func stolenOpening(day string) string {
	if isChristmasEve(day) {
		return "It's Christmas Eve, and Doodlemas is MINE. One night left to ruin Christmas for good."
	}
	return "Doodlemas is MINE now. I stole it. Every last cheerful bit."
}

// How long the app waits on the model for an intro before using the stock one
const introTimeout = 12 * time.Second

// After a failed intro, how long before the model is asked again
const introRetryAfter = 10 * time.Minute

// How long the app waits on the database for a saved intro
const introStoreTimeout = 5 * time.Second

// IntroStore keeps each judge's intro for a day, so it's written once for everyone, however
// many servers there are or however often they restart.
type IntroStore interface {
	// Load returns the saved intro; found is false when there isn't one yet.
	Load(ctx context.Context, day, personalityID, sourceHash string) (lines []string, found bool, err error)
	// Save keeps lines unless an intro is already saved, and returns whichever is saved.
	Save(ctx context.Context, day, personalityID, sourceHash string, lines []string) ([]string, error)
}

// DBIntroStore keeps intros in the judge_intros table.
type DBIntroStore struct{ DB *sql.DB }

func (s DBIntroStore) Load(ctx context.Context, day, personalityID, sourceHash string) ([]string, bool, error) {
	return queries.GetJudgeIntro(s.DB, ctx, day, personalityID, sourceHash)
}

func (s DBIntroStore) Save(ctx context.Context, day, personalityID, sourceHash string, lines []string) ([]string, error) {
	return queries.SaveJudgeIntro(s.DB, ctx, day, personalityID, sourceHash, lines)
}

// introSourceHash fingerprints what an intro is written from: the rules, the prompt and
// who the judge is. Changing any of them gets a fresh intro.
func introSourceHash(p models.AIPersonality, prompt, day string) string {
	sum := sha256.Sum256([]byte(IntroSystemPrompt(p, prompt, day)))
	return hex.EncodeToString(sum[:8])
}

type introKey struct {
	day, personalityID, sourceHash string
}

type introEntry struct {
	ready   chan struct{}
	lines   []string
	expires time.Time // Zero for a written intro, which lasts the day
}

// Intros are written once per judge per day and shared by everyone: saved in the store,
// with a copy in memory so a server only looks it up once.
var intros = struct {
	sync.Mutex
	byKey map[introKey]*introEntry
}{byKey: map[introKey]*introEntry{}}

// TodaysIntro returns the judge's lines asking for today's prompt (for a judge that scores
// backwards, as kept: pick a player's with StolenIntro): the saved ones, or
// written the first time anyone asks (callers at the same moment share the one request).
// Falls back to the stock lines when the provider can't talk or the model fails; those
// aren't saved, so the model is asked again a little later. store may be nil.
func TodaysIntro(ctx context.Context, provider Provider, store IntroStore, p models.AIPersonality, day, prompt string) []string {
	key := introKey{day, p.ID, introSourceHash(p, prompt, day)}

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
		go writeIntro(entry, provider, store, key, p, prompt)
	}
	intros.Unlock()

	select {
	case <-entry.ready:
		return entry.lines
	case <-ctx.Done():
		return StockIntroFor(p, prompt, day)
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

// writeIntro uses the saved intro, or asks the model for one and saves it. It runs on its
// own clock so one impatient caller leaving doesn't waste it for everyone else.
func writeIntro(entry *introEntry, provider Provider, store IntroStore, key introKey, p models.AIPersonality, prompt string) {
	defer close(entry.ready)

	if store != nil {
		ctx, cancel := context.WithTimeout(context.Background(), introStoreTimeout)
		lines, found, err := store.Load(ctx, key.day, key.personalityID, key.sourceHash)
		cancel()
		if err != nil {
			// Still worth writing one; it just can't be shared
			log.Printf("AI judge: couldn't load %s's intro: %v", p.Name, err)
		}
		if found {
			entry.lines = lines
			return
		}
	}

	talker, ok := provider.(Talker)
	if !ok {
		entry.lines = StockIntroFor(p, prompt, key.day)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), introTimeout)
	defer cancel()

	raw, err := talker.Talk(ctx, IntroSystemPrompt(p, prompt, key.day), "The player is here.", "judge_intro", IntroSchemaFor(p))
	if err == nil {
		entry.lines, err = ParseIntroFor(raw, p, prompt)
	}
	if err != nil {
		log.Printf("AI judge: %s couldn't write an intro for %q: %v", p.Name, prompt, err)
		entry.lines = StockIntroFor(p, prompt, key.day)
		entry.expires = time.Now().Add(introRetryAfter)
		return
	}

	if store != nil {
		saveCtx, cancel := context.WithTimeout(context.Background(), introStoreTimeout)
		defer cancel()
		saved, err := store.Save(saveCtx, key.day, key.personalityID, key.sourceHash, entry.lines)
		if err != nil {
			// This server keeps its own for the day, rather than asking the model again
			log.Printf("AI judge: couldn't save %s's intro: %v", p.Name, err)
			return
		}
		entry.lines = saved
	}
}
