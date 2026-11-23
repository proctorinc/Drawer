package ai

import (
	"context"
	"drawer-service-backend/internal/db/models"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func TestParseIntro(t *testing.T) {
	good := `{"lines": ["Hark, a doodler!", "I need you to draw me a goalie, mine let in forty goals.", "I shall rate it after."]}`
	lines, err := ParseIntro(good, "A goalie")
	if err != nil || len(lines) != 3 {
		t.Fatalf("good intro: %v, %v", lines, err)
	}

	bad := map[string]string{
		"one line":         `{"lines": ["Draw me a goalie."]}`,
		"four lines":       `{"lines": ["a", "b", "goalie", "d"]}`,
		"never asks":       `{"lines": ["Hello!", "Draw me a striker."]}`,
		"rambles":          `{"lines": ["Hi!", "Draw me a goalie ` + strings.Repeat("please ", 30) + `"]}`,
		"not json":         `Draw me a goalie`,
		"blank lines only": `{"lines": ["", "  "]}`,
	}
	for name, raw := range bad {
		if _, err := ParseIntro(raw, "A goalie"); err == nil {
			t.Errorf("%s: should be rejected", name)
		}
	}
}

type talkingProvider struct {
	answer string
	err    error
	calls  *atomic.Int32
}

func (p talkingProvider) Ask(context.Context, Call) (string, error) { return "", nil }
func (p talkingProvider) Model() string                             { return "talking" }
func (p talkingProvider) Talk(_ context.Context, system, _, _ string, _ map[string]any) (string, error) {
	p.calls.Add(1)
	if !strings.Contains(system, `"a goalie"`) || !strings.Contains(system, "Pompous") {
		return "", errors.New("system prompt is missing the prompt or the character")
	}
	return p.answer, p.err
}

func TestTodaysIntroIsWrittenOncePerDay(t *testing.T) {
	ctx := context.Background()
	judge := models.AIPersonality{ID: "j1", Name: "Sir", SystemPrompt: "Pompous."}
	calls := &atomic.Int32{}
	provider := talkingProvider{answer: `{"lines": ["Ho there!", "Draw me a goalie, for my castle."]}`, calls: calls}

	for range 3 {
		lines := TodaysIntro(ctx, provider, nil, judge, "2099-01-01", "a goalie")
		if len(lines) != 2 || lines[1] != "Draw me a goalie, for my castle." {
			t.Fatalf("lines = %v", lines)
		}
	}
	if calls.Load() != 1 {
		t.Errorf("asked the model %d times; want once", calls.Load())
	}

	// A new day asks again
	TodaysIntro(ctx, provider, nil, judge, "2099-01-02", "a goalie")
	if calls.Load() != 2 {
		t.Errorf("asked the model %d times; want twice", calls.Load())
	}
}

func TestTodaysIntroFallsBack(t *testing.T) {
	ctx := context.Background()
	judge := models.AIPersonality{ID: "j2", Name: "Sir", SystemPrompt: "Pompous."}

	failing := talkingProvider{err: errors.New("down"), calls: &atomic.Int32{}}
	lines := TodaysIntro(ctx, failing, nil, judge, "2099-02-01", "a goalie")
	if len(lines) != 3 || !strings.Contains(lines[1], "draw me a goalie") {
		t.Errorf("failed model: lines = %v; want the stock ones", lines)
	}

	// Can't talk at all (only judges)
	silent := recordingProvider{prompt: new(string), judge: new(string)}
	lines = TodaysIntro(ctx, silent, nil, judge, "2099-02-02", "A goalie")
	if !strings.Contains(lines[1], "draw me a goalie") {
		t.Errorf("silent provider: lines = %v", lines)
	}
}

// memoryStore is an IntroStore shared by "servers" in a test
type memoryStore struct {
	mu    sync.Mutex
	saved map[string][]string
	saves int
}

func (m *memoryStore) Load(_ context.Context, day, id, hash string) ([]string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	lines, ok := m.saved[day+id+hash]
	return lines, ok, nil
}

func (m *memoryStore) Save(_ context.Context, day, id, hash string, lines []string) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.saves++
	if saved, ok := m.saved[day+id+hash]; ok {
		return saved, nil
	}
	m.saved[day+id+hash] = lines
	return lines, nil
}

// forgetIntros is a server restarting: its in-memory copies are gone
func forgetIntros() {
	intros.Lock()
	intros.byKey = map[introKey]*introEntry{}
	intros.Unlock()
}

func TestTodaysIntroIsSharedAcrossServers(t *testing.T) {
	ctx := context.Background()
	judge := models.AIPersonality{ID: "j3", Name: "Sir", SystemPrompt: "Pompous."}
	calls := &atomic.Int32{}
	provider := talkingProvider{answer: `{"lines": ["Ho there!", "Draw me a goalie, for my castle."]}`, calls: calls}
	store := &memoryStore{saved: map[string][]string{}}

	first := TodaysIntro(ctx, provider, store, judge, "2099-03-01", "a goalie")
	forgetIntros()
	// Another server (or a restart) gets the same lines without asking the model
	again := TodaysIntro(ctx, provider, store, judge, "2099-03-01", "a goalie")
	if calls.Load() != 1 || strings.Join(first, "|") != strings.Join(again, "|") {
		t.Fatalf("asked the model %d times, lines %v then %v; want once, the same", calls.Load(), first, again)
	}

	// Editing who the judge is gets a fresh one
	forgetIntros()
	judge.SystemPrompt = "Pompous and loud."
	TodaysIntro(ctx, provider, store, judge, "2099-03-01", "a goalie")
	if calls.Load() != 2 {
		t.Errorf("asked the model %d times after an edit; want twice", calls.Load())
	}

	// Stock lines from a failed model aren't saved
	failing := talkingProvider{err: errors.New("down"), calls: &atomic.Int32{}}
	TodaysIntro(ctx, failing, store, judge, "2099-03-02", "a goalie")
	if store.saves != 2 {
		t.Errorf("saved %d intros; want 2 (not the stock one)", store.saves)
	}
}
