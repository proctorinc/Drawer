package ai

import (
	"context"
	"drawer-service-backend/internal/db/models"
	"errors"
	"strings"
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

func (p talkingProvider) Judge(context.Context, Request) (string, error) { return "", nil }
func (p talkingProvider) Model() string                                  { return "talking" }
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
		lines := TodaysIntro(ctx, provider, judge, "2099-01-01", "a goalie")
		if len(lines) != 2 || lines[1] != "Draw me a goalie, for my castle." {
			t.Fatalf("lines = %v", lines)
		}
	}
	if calls.Load() != 1 {
		t.Errorf("asked the model %d times; want once", calls.Load())
	}

	// A new day asks again
	TodaysIntro(ctx, provider, judge, "2099-01-02", "a goalie")
	if calls.Load() != 2 {
		t.Errorf("asked the model %d times; want twice", calls.Load())
	}
}

func TestTodaysIntroFallsBack(t *testing.T) {
	ctx := context.Background()
	judge := models.AIPersonality{ID: "j2", Name: "Sir", SystemPrompt: "Pompous."}

	failing := talkingProvider{err: errors.New("down"), calls: &atomic.Int32{}}
	lines := TodaysIntro(ctx, failing, judge, "2099-02-01", "a goalie")
	if len(lines) != 3 || !strings.Contains(lines[1], "draw me a goalie") {
		t.Errorf("failed model: lines = %v; want the stock ones", lines)
	}

	// Can't talk at all (only judges)
	silent := recordingProvider{prompt: new(string), judge: new(string)}
	lines = TodaysIntro(ctx, silent, judge, "2099-02-02", "A goalie")
	if !strings.Contains(lines[1], "draw me a goalie") {
		t.Errorf("silent provider: lines = %v", lines)
	}
}
