package queries

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"testing"
)

func TestMarkAchievementsCelebrated(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	for _, stmt := range []string{
		`INSERT INTO users (id, username, email) VALUES ('ann', 'ann', 'ann@example.com'), ('bob', 'bob', 'bob@example.com')`,
		`INSERT INTO achievements (id, image_url, name, description, achievement_field, achievement_value) VALUES
			('cel-a', '', 'A', '', 'test', 1), ('cel-b', '', 'B', '', 'test', 1), ('cel-c', '', 'C', '', 'test', 1)`,
		`INSERT INTO user_achievements (user_id, achievement_id) VALUES ('ann', 'cel-a'), ('ann', 'cel-b'), ('bob', 'cel-a')`,
	} {
		if _, err := repo.Exec(stmt); err != nil {
			t.Fatal(err)
		}
	}

	celebrated := func(userID string) map[string]bool {
		t.Helper()
		list, _, err := GetAchievementsAndRewardsByUserID(repo, ctx, userID)
		if err != nil {
			t.Fatal(err)
		}
		got := map[string]bool{}
		for _, a := range list {
			if a.ID == "cel-a" || a.ID == "cel-b" || a.ID == "cel-c" {
				got[a.ID] = a.Celebrated
			}
		}
		return got
	}

	// Newly earned ones haven't been celebrated yet
	if got := celebrated("ann"); got["cel-a"] || got["cel-b"] {
		t.Fatalf("nothing should be celebrated yet: %v", got)
	}

	// Marking one leaves the other, and someone else's, alone; unearned ids are ignored
	if err := MarkAchievementsCelebrated(repo, ctx, "ann", []string{"cel-a", "cel-c"}); err != nil {
		t.Fatal(err)
	}
	if got := celebrated("ann"); !got["cel-a"] || got["cel-b"] || got["cel-c"] {
		t.Errorf("ann = %v; want only cel-a celebrated", got)
	}
	if got := celebrated("bob"); got["cel-a"] {
		t.Errorf("bob = %v; ann's celebration shouldn't count for bob", got)
	}

	// Marking again is harmless
	if err := MarkAchievementsCelebrated(repo, ctx, "ann", []string{"cel-a", "cel-b"}); err != nil {
		t.Fatal(err)
	}
	if got := celebrated("ann"); !got["cel-a"] || !got["cel-b"] {
		t.Errorf("ann = %v; want both celebrated", got)
	}
}
