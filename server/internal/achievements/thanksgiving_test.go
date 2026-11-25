package achievements

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"testing"
)

func TestThanksgivingSticker(t *testing.T) {
	tests := []struct {
		name  string
		first string
		count int
		want  bool
	}{
		{"the week before", "2026-11-19", 7, false}, // Nov 19 - Nov 25
		{"black friday on", "2026-11-27", 3, false},
		{"thanksgiving 2026", "2026-11-26", 1, true},
		{"thanksgiving 2027", "2027-11-25", 1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := dbtest.NewEventsDB(t)
			dbtest.ApplyMigration(t, repo, "1795040200_seed_thanksgiving.up.sql")
			dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@example.com')`)
			submitDays(t, repo, "me", tt.first, tt.count)

			// Not an event sticker, so earnedStickers skips it: look it up directly
			if err := NewAchievementService(repo, context.Background(), "me").UpdateSubmissionAchievements("me"); err != nil {
				t.Fatal(err)
			}
			var earned int
			if err := repo.QueryRow(`SELECT COUNT(*) FROM user_achievements WHERE user_id = 'me' AND achievement_id = 'thanksgiving-doodle'`).Scan(&earned); err != nil {
				t.Fatal(err)
			}
			if got := earned == 1; got != tt.want {
				t.Errorf("earned thanksgiving-doodle = %v, want %v", got, tt.want)
			}
		})
	}
}
