package achievements

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/queries"
	"fmt"
	"testing"
	"time"
)

func earnedStickers(t *testing.T, repo *sql.DB, userID string) map[string]bool {
	t.Helper()
	if err := NewAchievementService(repo, context.Background(), userID).UpdateSubmissionAchievements(userID); err != nil {
		t.Fatal(err)
	}
	achievements, _, err := queries.GetAchievementsAndRewardsByUserID(repo, context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	earned := map[string]bool{}
	for _, achievement := range achievements {
		if achievement.AchievedAt != nil {
			earned[achievement.ID] = true
		}
	}
	return earned
}

// submitDays adds one submission per day for `count` days starting at `first`.
func submitDays(t *testing.T, repo *sql.DB, userID, first string, count int) {
	start, _ := time.Parse("2006-01-02", first)
	for i := range count {
		day := start.AddDate(0, 0, i).Format("2006-01-02")
		dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES (?, ?, ?)`,
			fmt.Sprintf("%s-%s", userID, day), userID, day)
	}
}

func TestEventStickerThresholds(t *testing.T) {
	const (
		firstSnow  = "christmas-2026-first-snow"
		twelveDays = "christmas-2026-twelve-days"
		claus      = "christmas-2026-doodle-claus"
	)
	tests := []struct {
		name   string
		submit func(t *testing.T, repo *sql.DB, userID string)
		want   []string
	}{
		{"nothing in the window", func(t *testing.T, repo *sql.DB, userID string) {
			submitDays(t, repo, userID, "2026-11-01", 26) // Nov 1 - Nov 26
			submitDays(t, repo, userID, "2027-01-01", 20) // after the event
		}, nil},
		{"one event doodle", func(t *testing.T, repo *sql.DB, userID string) {
			submitDays(t, repo, userID, "2026-12-31", 1)
		}, []string{firstSnow}},
		{"eleven event doodles", func(t *testing.T, repo *sql.DB, userID string) {
			submitDays(t, repo, userID, "2026-12-21", 11)
		}, []string{firstSnow}},
		{"twelve event doodles", func(t *testing.T, repo *sql.DB, userID string) {
			submitDays(t, repo, userID, "2026-12-20", 12)
		}, []string{firstSnow, twelveDays}},
		{"28 of the 29 countdown days plus the rest of the event", func(t *testing.T, repo *sql.DB, userID string) {
			submitDays(t, repo, userID, "2026-11-28", 34) // misses Nov 27
		}, []string{firstSnow, twelveDays}},
		{"every countdown day", func(t *testing.T, repo *sql.DB, userID string) {
			submitDays(t, repo, userID, "2026-11-27", 29)
		}, []string{firstSnow, twelveDays, claus}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := dbtest.NewEventsDB(t)
			dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@example.com')`)
			tt.submit(t, repo, "me")

			earned := earnedStickers(t, repo, "me")
			if len(earned) != len(tt.want) {
				t.Errorf("earned %v, want %v", earned, tt.want)
			}
			for _, id := range tt.want {
				if !earned[id] {
					t.Errorf("missing %s; earned %v", id, earned)
				}
			}
		})
	}
}

func TestEventStickerProgress(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@example.com')`)
	submitDays(t, repo, "me", "2026-12-20", 10) // Dec 20 - 29: 6 countdown days

	achievements, _, err := NewAchievementService(repo, context.Background(), "me").GetAllAchievements("me")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]int{"christmas-2026-first-snow": 10, "christmas-2026-twelve-days": 10, "christmas-2026-doodle-claus": 6}
	for _, achievement := range achievements {
		if achievement.Progress != want[achievement.ID] {
			t.Errorf("%s: progress = %d, want %d", achievement.ID, achievement.Progress, want[achievement.ID])
		}
	}
}
