package queries

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"strings"
	"testing"
)

func TestJudgeIntros(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()

	if _, found, err := GetJudgeIntro(repo, ctx, "2099-01-01", "j", "h1"); err != nil || found {
		t.Fatalf("empty: found=%v err=%v", found, err)
	}

	first := []string{"Hi!", "Draw me a goalie."}
	saved, err := SaveJudgeIntro(repo, ctx, "2099-01-01", "j", "h1", first)
	if err != nil || strings.Join(saved, "|") != "Hi!|Draw me a goalie." {
		t.Fatalf("save: %v, %v", saved, err)
	}

	// A second writer gets the first one back
	saved, err = SaveJudgeIntro(repo, ctx, "2099-01-01", "j", "h1", []string{"Other", "lines"})
	if err != nil || strings.Join(saved, "|") != "Hi!|Draw me a goalie." {
		t.Errorf("second save: %v, %v; want the first lines", saved, err)
	}

	lines, found, err := GetJudgeIntro(repo, ctx, "2099-01-01", "j", "h1")
	if err != nil || !found || len(lines) != 2 {
		t.Errorf("get: %v, %v, %v", lines, found, err)
	}
	// A different source is a different intro
	if _, found, _ := GetJudgeIntro(repo, ctx, "2099-01-01", "j", "h2"); found {
		t.Error("another source hash shouldn't find it")
	}
}
