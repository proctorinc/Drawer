package queries

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"testing"
)

// Each Grinch Sunday lands in the right box by the answer and his score, and only once the
// doodle that locks the answer in is drawn
func TestGetGrinchSundays(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x');
		INSERT INTO ai_personalities (id, slug, name, system_prompt, scores_backwards) VALUES
			('ai-grinch', 'grinch', 'The Grinch', '', 1),
			('ai-santa', 'santa', 'Santa', '', 0);
		INSERT INTO judge_pledges (user_id, day, personality_id, joined) VALUES
			('me', '2026-11-29', 'ai-grinch', 1), -- joined, drew badly: loyal
			('me', '2026-12-06', 'ai-grinch', 1), -- joined, drew well: double agent
			('me', '2026-12-13', 'ai-grinch', 0), -- refused, drew well: a true who
			('me', '2026-12-20', 'ai-grinch', 0), -- refused, drew badly: all talk
			('me', '2026-12-27', 'ai-grinch', 1), -- joined, not judged yet: just joined
			('me', '2027-01-03', 'ai-grinch', 0); -- never drew: doesn't count
		INSERT INTO user_submissions (id, user_id, day) VALUES
			('s1', 'me', '2026-11-29'), ('s2', 'me', '2026-12-06'), ('s3', 'me', '2026-12-13'),
			('s4', 'me', '2026-12-20'), ('s5', 'me', '2026-12-27');
		INSERT INTO ai_reviews (submission_id, personality_id, status, score) VALUES
			('s1', 'ai-grinch', 'done', 8), ('s2', 'ai-grinch', 'done', 1),
			('s3', 'ai-grinch', 'done', 3), ('s4', 'ai-grinch', 'done', 7);
	`)
	if err != nil {
		t.Fatal(err)
	}

	got, err := GetGrinchSundays(db, context.Background(), "me", 7, 3)
	if err != nil {
		t.Fatal(err)
	}
	want := GrinchSundays{Joined: 3, Refused: 2, Loyal: 1, Double: 1, TrueWho: 1, AllTalk: 1}
	if got != want {
		t.Errorf("Grinch Sundays = %+v, want %+v", got, want)
	}
}

// Festive reactions given and received, and comments, count inside the event's days only
func TestDoodlemasCounts(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO events (id, slug, name, theme, starts_at, ends_at) VALUES
			('xmas', 'christmas-2026', 'Doodlemas', 'christmas', '2026-11-27T00:00:00Z', '2027-01-01T00:00:00Z');
		INSERT INTO event_reactions (event_id, reaction_id) VALUES ('xmas', 'snowflake');
		INSERT INTO ai_personalities (id, slug, name, system_prompt, scores_backwards) VALUES
			('ai-grinch', 'grinch', 'The Grinch', '', 1),
			('ai-santa', 'santa', 'Santa', '', 0);
		INSERT INTO user_submissions (id, user_id, day) VALUES
			('p1', 'pal', '2026-11-20'), ('p2', 'pal', '2026-12-01'),
			('m1', 'me', '2026-11-20'), ('m2', 'me', '2026-12-01'), ('m3', 'me', '2026-12-02');
		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('me', 'submission', 'p2', 'snowflake', '2026-12-01 10:00:00'), -- counts
			('me', 'submission', 'p2', 'heart', '2026-12-01 10:00:00'),     -- not festive
			('me', 'submission', 'p1', 'snowflake', '2026-11-20 10:00:00'), -- before the event
			('me', 'submission', 'm2', 'snowflake', '2026-12-01 10:00:00'); -- my own doodle
		INSERT INTO comments (submission_id, user_id, text, created_at) VALUES
			('p2', 'me', 'nice', '2026-12-01 10:00:00'),  -- counts
			('p1', 'me', 'nice', '2026-11-20 10:00:00'),  -- before the event
			('m2', 'me', 'mine', '2026-12-01 10:00:00');  -- my own doodle
		INSERT INTO ai_reviews (submission_id, personality_id, status, score) VALUES
			('m1', 'ai-santa', 'done', 9),  -- before the event
			('m2', 'ai-santa', 'done', 8),  -- counts
			('m3', 'ai-grinch', 'done', 9); -- scores backwards
	`)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	if n, err := CountEventReactionsGiven(db, ctx, "me", "xmas", "2026-11-27", "2026-12-31"); err != nil || n != 1 {
		t.Errorf("event reactions given = %d, %v; want 1", n, err)
	}
	if n, err := CountCommentsWrittenBetween(db, ctx, "me", "2026-11-27", "2026-12-31"); err != nil || n != 1 {
		t.Errorf("comments written = %d, %v; want 1", n, err)
	}
	if n, err := CountFriendsCheered(db, ctx, "me", "xmas", "2026-11-27", "2026-12-31"); err != nil || n != 1 {
		t.Errorf("friends cheered = %d, %v; want 1", n, err)
	}
	if n, err := CountEventReactionsReceived(db, ctx, "pal", "xmas", "2026-11-27", "2026-12-31"); err != nil || n != 1 {
		t.Errorf("event reactions received = %d, %v; want 1", n, err)
	}
}

// The Grinch's days come with your answer on each, and only his days
func TestGetGrinchDays(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x');
		INSERT INTO ai_personalities (id, slug, name, system_prompt, scores_backwards) VALUES
			('ai-grinch', 'grinch', 'The Grinch', '', 1),
			('ai-santa', 'santa', 'Santa', '', 0);
		INSERT INTO daily_prompts (day, colors, prompt, judge_id) VALUES
			('2026-11-29', '[]', 'a', 'ai-grinch'),
			('2026-11-30', '[]', 'b', 'ai-santa'),
			('2026-12-06', '[]', 'c', 'ai-grinch'),
			('2026-12-13', '[]', 'd', 'ai-grinch'),
			('2027-01-03', '[]', 'e', 'ai-grinch'); -- after the event
		INSERT INTO judge_pledges (user_id, day, personality_id, joined) VALUES
			('me', '2026-11-29', 'ai-grinch', 1),
			('me', '2026-12-06', 'ai-grinch', 0);
	`)
	if err != nil {
		t.Fatal(err)
	}

	days, err := GetGrinchDays(db, context.Background(), "me", "2026-11-27", "2026-12-31")
	if err != nil {
		t.Fatal(err)
	}
	answer := func(d GrinchDay) string {
		if d.Joined == nil {
			return d.Day + ":none"
		}
		return fmt.Sprintf("%s:%v", d.Day, *d.Joined)
	}
	got := []string{}
	for _, d := range days {
		got = append(got, answer(d))
	}
	want := "2026-11-29:true,2026-12-06:false,2026-12-13:none"
	if strings.Join(got, ",") != want {
		t.Errorf("Grinch days = %v, want %s", got, want)
	}
}

// You see your own and your friends' answers for the day, nobody else's
func TestGetDayPledges(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES
			('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x'), ('pal2', 'pal2', 'pal2@x'),
			('pending', 'pending', 'pending@x'), ('stranger', 'stranger', 'stranger@x');
		INSERT INTO friendships (user1, user2, state, inviter_id) VALUES
			('me', 'pal', 'accepted', 'me'),
			('pal2', 'me', 'accepted', 'pal2'),
			('me', 'pending', 'pending', 'me');
		INSERT INTO judge_pledges (user_id, day, personality_id, joined) VALUES
			('me', '2026-11-29', 'ai-grinch', 0),
			('pal', '2026-11-29', 'ai-grinch', 1),
			('pal2', '2026-11-29', 'ai-grinch', 1),
			('pal2', '2026-12-06', 'ai-grinch', 0), -- another day
			('pending', '2026-11-29', 'ai-grinch', 1),
			('stranger', '2026-11-29', 'ai-grinch', 1);
	`)
	if err != nil {
		t.Fatal(err)
	}

	joined, refused, err := GetDayPledges(db, context.Background(), "me", "2026-11-29")
	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(joined)
	if strings.Join(joined, ",") != "pal,pal2" || strings.Join(refused, ",") != "me" {
		t.Errorf("joined = %v, refused = %v; want [pal pal2] and [me]", joined, refused)
	}
}
