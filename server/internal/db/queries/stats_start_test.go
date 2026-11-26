package queries

import (
	"context"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"os"
	"testing"
	"time"
)

// Activity before a user's stats start day counts toward none of their stats, while
// everyone else's counts in full
func TestStatsStartDay(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	_, err := db.Exec(`
		INSERT INTO users (id, username, email, stats_start_day) VALUES
			('me', 'me', 'me@x', '2026-11-19'), ('pal', 'pal', 'pal@x', NULL);
		INSERT INTO user_submissions (id, user_id, day, created_at) VALUES
			('me-old1', 'me', '2026-11-17', '2026-11-17 20:00:00'),
			('me-old2', 'me', '2026-11-18', '2026-11-18 20:00:00'),
			('me-new1', 'me', '2026-11-19', '2026-11-19 20:00:00'),
			('me-new2', 'me', '2026-11-20', '2026-11-20 20:00:00'),
			('pal-old', 'pal', '2026-11-17', '2026-11-17 20:00:00');
		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('me', 'submission', 'pal-old', 'heart', '2026-11-17 21:00:00'),  -- mine, before
			('me', 'submission', 'pal-old', 'fire', '2026-11-20 21:00:00'),   -- mine, after
			('pal', 'submission', 'me-old1', 'heart', '2026-11-17 21:00:00'), -- on mine, before
			('pal', 'submission', 'me-old1', 'fire', '2026-11-20 21:00:00');  -- old drawing, new reaction
		INSERT INTO comments (id, submission_id, user_id, text, created_at) VALUES
			(1, 'pal-old', 'me', 'old', '2026-11-17 21:00:00'),
			(2, 'pal-old', 'me', 'new', '2026-11-20 21:00:00');
	`)
	if err != nil {
		t.Fatal(err)
	}

	counts, err := GetActivityCounts(db, ctx, []string{"me", "pal"}, BeginningOfTime, EndOfTime)
	if err != nil {
		t.Fatal(err)
	}
	me := counts["me"]
	if me.Drawings != 2 || me.ReactionsGiven != 1 || me.ReactionsGivenForXP != 1 ||
		me.CommentsWritten != 1 || me.CommentsWrittenForXP != 1 || me.ReactionsReceived != 1 {
		t.Errorf("me = %+v; want 2 drawings and 1 each of reactions given, comments and reactions received", me)
	}
	pal := counts["pal"]
	if pal.Drawings != 1 || pal.ReactionsGiven != 2 || pal.ReactionsReceived != 2 {
		t.Errorf("pal = %+v; want everything: 1 drawing, 2 reactions given, 2 received", pal)
	}

	events, err := GetXPEventsSince(db, ctx, "me", BeginningOfTime)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range events {
		if e.At.Before(time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC)) {
			t.Errorf("XP event %s at %s is before the start day", e.Kind, e.At)
		}
	}

	for name, got := range map[string]func() (int, error){
		"drawings":   func() (int, error) { return CalculateSubmissionCount(db, ctx, "me") },
		"comments":   func() (int, error) { return CalculateCommentCount(db, ctx, "me") },
		"reactions":  func() (int, error) { return CalculateReactionCount(db, ctx, "me") },
		"max streak": func() (int, error) { return CalculateSubmissionMaxStreak(db, ctx, "me") },
	} {
		n, err := got()
		if err != nil {
			t.Fatal(err)
		}
		want := map[string]int{"drawings": 2, "comments": 1, "reactions": 1, "max streak": 2}[name]
		if n != want {
			t.Errorf("me %s = %d, want %d", name, n, want)
		}
	}
	if n, _ := CalculateSubmissionCount(db, ctx, "pal"); n != 1 {
		t.Errorf("pal drawings = %d, want 1", n)
	}

	// Profiles, your own and as a friend sees it, show the same restarted drawing count
	mine, err := GetUserProfileFromDB(db, ctx, "me", "me", &config.Config{})
	if err != nil {
		t.Fatal(err)
	}
	theirs, err := GetUserProfileFromDB(db, ctx, "me", "pal", &config.Config{})
	if err != nil {
		t.Fatal(err)
	}
	for name, stats := range map[string]models.UserStats{"own profile": mine.Stats, "friend's view": theirs.Stats} {
		if stats.TotalDrawings != 2 {
			t.Errorf("%s total drawings = %d, want 2", name, stats.TotalDrawings)
		}
	}
}

// Friends made before the stats start day don't count toward friend achievements
func TestStatsStartDayFriends(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	_, err := db.Exec(`
		INSERT INTO users (id, username, email, stats_start_day) VALUES
			('me', 'me', 'me@x', '2026-11-19'), ('a', 'a', 'a@x', NULL), ('b', 'b', 'b@x', NULL),
			('c', 'c', 'c@x', NULL);
		INSERT INTO friendships (user1, user2, state, inviter_id, created_at, accepted_at) VALUES
			('me', 'a', 'accepted', 'me', '2026-11-01 10:00:00', '2026-11-01 10:00:00'),
			('b', 'me', 'accepted', 'b', '2026-11-01 10:00:00', NULL),
			('me', 'c', 'accepted', 'me', '2026-11-10 10:00:00', '2026-11-20 10:00:00');
	`)
	if err != nil {
		t.Fatal(err)
	}
	if n, err := CalculateFriendCount(db, ctx, "me"); err != nil || n != 1 {
		t.Errorf("my friends = %d (%v), want 1, accepted after the start day", n, err)
	}
	if n, err := CalculateFriendCount(db, ctx, "a"); err != nil || n != 1 {
		t.Errorf("a's friends = %d (%v), want 1, with no start day", n, err)
	}
}

// The migration restarts matty_p alone: their achievements move to the archive, and the
// down migration puts them back
func TestStatsStartDayMigration(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		DROP TABLE user_achievements_archive;
		ALTER TABLE users DROP COLUMN stats_start_day;
		INSERT INTO users (id, username, email) VALUES
			('7ae9ca508a8fc36150eeb1fd6a69d174', 'matty_p', 'm@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO achievements (id, image_url, name, description, achievement_field, achievement_value) VALUES
			('first', '', '', '', 'SUBMISSION_TOTAL', 1);
		INSERT INTO user_achievements (user_id, achievement_id, created_at, celebrated_at) VALUES
			('7ae9ca508a8fc36150eeb1fd6a69d174', 'first', '2025-06-01 00:00:00', '2025-06-01 00:00:01'),
			('pal', 'first', '2025-06-02 00:00:00', NULL);
	`)
	if err != nil {
		t.Fatal(err)
	}
	run := func(name string) {
		t.Helper()
		sql, err := os.ReadFile("../../../migrations/1795131800_add_stats_start_day." + name + ".sql")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(string(sql)); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
	}
	earned := func() map[string]bool {
		t.Helper()
		got := map[string]bool{}
		rows, err := db.Query(`SELECT user_id FROM user_achievements`)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		for rows.Next() {
			var id string
			rows.Scan(&id)
			got[id] = true
		}
		return got
	}

	run("up")
	var start string
	if err := db.QueryRow(`SELECT stats_start_day FROM users WHERE username = 'matty_p'`).Scan(&start); err != nil || start != "2026-11-19" {
		t.Errorf("matty_p starts %q (%v), want 2026-11-19", start, err)
	}
	if got := earned(); got["7ae9ca508a8fc36150eeb1fd6a69d174"] || !got["pal"] {
		t.Errorf("after up, achievements held by %v; want only pal's", got)
	}

	run("down")
	if got := earned(); !got["7ae9ca508a8fc36150eeb1fd6a69d174"] || !got["pal"] {
		t.Errorf("after down, achievements held by %v; want both back", got)
	}
}
