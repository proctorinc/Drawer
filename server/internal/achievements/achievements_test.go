package achievements

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"testing"
	"time"
)

func achievementsByID(t *testing.T, all []models.Achievement) map[string]models.Achievement {
	t.Helper()
	byID := map[string]models.Achievement{}
	for _, a := range all {
		byID[a.ID] = a
	}
	return byID
}

func TestJudgeAndLevelAchievementsCatchUpOnRead(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@example.com')`)
	submitDays(t, repo, "me", "2026-10-01", 3)
	dbtest.Exec(t, repo, `INSERT INTO ai_reviews (submission_id, personality_id, status, score) VALUES
		('me-2026-10-01', 'ai-sir-doodleton', 'done', 9.4),
		('me-2026-10-02', 'ai-professor-pickles', 'done', 1.5),
		('me-2026-10-03', 'ai-santa', 'pending', NULL)`)

	all, _, err := NewAchievementService(repo, context.Background(), "me").GetAllAchievements("me")
	if err != nil {
		t.Fatal(err)
	}
	got := achievementsByID(t, all)

	for id, wantEarned := range map[string]bool{
		"judged-1":      true,
		"judge-best-8":  true,
		"judge-best-9":  true,
		"judge-best-10": false,
		"judge-low-1":   true,
		"judges-met-3":  false, // the pending review doesn't count
		"streak-3":      true,
		"level-5":       false,
	} {
		if earned := got[id].AchievedAt != nil; earned != wantEarned {
			t.Errorf("%s: earned = %v, want %v (progress %d)", id, earned, wantEarned, got[id].Progress)
		}
	}
	if p := got["judge-best-10"].Progress; p != 9 {
		t.Errorf("judge-best-10 progress = %d, want 9 (the best score, rounded down)", p)
	}
	if p := got["judges-met-3"].Progress; p != 2 {
		t.Errorf("judges-met-3 progress = %d, want 2", p)
	}

	// Caught up for good, not just in this response
	stored, _, err := queries.GetAchievementsAndRewardsByUserID(repo, context.Background(), "me")
	if err != nil {
		t.Fatal(err)
	}
	if achievementsByID(t, stored)["judge-best-9"].AchievedAt == nil {
		t.Error("judge-best-9 wasn't saved as earned")
	}
}

func TestLevelAchievements(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@example.com')`)
	// 46 doodles is 460 XP, plus 25 for each achievement they earn: past level 5's 500
	submitDays(t, repo, "me", "2026-01-01", 46)

	if err := NewAchievementService(repo, context.Background(), "me").UpdateSubmissionAchievements("me"); err != nil {
		t.Fatal(err)
	}
	stored, _, err := queries.GetAchievementsAndRewardsByUserID(repo, context.Background(), "me")
	if err != nil {
		t.Fatal(err)
	}
	got := achievementsByID(t, stored)
	if got["level-5"].AchievedAt == nil {
		t.Error("level-5 not earned after 46 doodles")
	}
	if got["level-10"].AchievedAt != nil {
		t.Error("level-10 earned too early")
	}
}

func TestMask(t *testing.T) {
	slug := "christmas-2026"
	reward := &models.RewardUnlock{ID: "GOLDEN_SANTA_HAT", Name: "Golden Santa Hat"}
	hidden := models.Achievement{ID: "judge-best-10", Name: "perfect ten", Description: "Score a perfect 10",
		AchievementField: "AI_BEST_SCORE", AchievementValue: 10, Progress: 9, Category: "judges", Hidden: true}
	event := models.Achievement{ID: "christmas-2026-doodle-claus", Name: "doodle claus", Description: "Doodle every day",
		AchievementField: "EVENT_COUNTDOWN_TOTAL", AchievementValue: 29, Progress: 3, Category: "events",
		EventSlug: &slug, Reward: reward}
	shown := models.Achievement{ID: "streak-3", Name: "warming up", AchievementValue: 3, Category: "streaks"}

	for _, tt := range []struct {
		name       string
		in         models.Achievement
		events     bool
		wantSecret bool
	}{
		{"hidden", hidden, false, true},
		{"event sticker on the catalog", event, true, true},
		{"event sticker on the trophy page", event, false, false},
		{"everyday", shown, true, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got := Mask(tt.in, tt.events)
			if got.Secret != tt.wantSecret {
				t.Fatalf("Secret = %v, want %v", got.Secret, tt.wantSecret)
			}
			if !tt.wantSecret {
				if got.Name != tt.in.Name {
					t.Errorf("Name = %q, want it unchanged", got.Name)
				}
				return
			}
			if got.ID != tt.in.ID || got.Name != "???" || got.Description != "" || got.AchievementField != "" ||
				got.AchievementValue != 0 || got.Progress != 0 || got.Reward != nil || got.EventSlug != nil {
				t.Errorf("leaked details: %+v", got)
			}
		})
	}

	// Once earned, nothing's secret
	earned := hidden
	now := time.Now()
	earned.AchievedAt = &now
	if got := Mask(earned, true); got.Secret || got.Name != "perfect ten" {
		t.Errorf("earned hidden achievement was masked: %+v", got)
	}
}
