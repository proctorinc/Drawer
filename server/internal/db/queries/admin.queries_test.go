package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/dbtest"
	"errors"
	"testing"
	"time"
)

func TestAdminListings(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `
		INSERT INTO users (id, username, email, role, created_at) VALUES
			('ann', 'ann', 'ann@x.com', 'admin', '2026-11-01 09:00:00'),
			('bob', 'bob', 'bob@x.com', 'user', '2026-11-02 09:00:00');
		INSERT INTO daily_prompts (day, colors, prompt, created_by) VALUES ('2026-11-10', '["#000000"]', 'a goose', 'bob');
		INSERT INTO user_submissions (id, user_id, day, created_at) VALUES ('s1', 'bob', '2026-11-10', '2026-11-10 10:00:00');
		INSERT INTO comments (submission_id, user_id, text, created_at) VALUES ('s1', 'ann', 'honk', '2026-11-10 11:00:00');
		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at)
			VALUES ('ann', 'comment', '1', 'heart', '2026-11-10 12:00:00');
		INSERT INTO friendships (user1, user2, state, inviter_id, created_at, accepted_at)
			VALUES ('ann', 'bob', 'accepted', 'bob', '2026-11-03 09:00:00', '2026-11-04 09:00:00');`)

	users, err := GetAdminUsers(repo, ctx)
	if err != nil || len(users) != 2 {
		t.Fatalf("GetAdminUsers = %d users, %v", len(users), err)
	}
	bob := users[0] // newest first
	if bob.Username != "bob" || bob.Drawings != 1 || bob.Friends != 1 || bob.IsAdmin || *bob.LastDrawnDay != "2026-11-10" {
		t.Errorf("bob = %+v", bob)
	}
	if !users[1].IsAdmin {
		t.Errorf("ann should be an admin")
	}

	prompts, err := GetAllPrompts(repo, ctx)
	if err != nil {
		t.Fatal(err)
	}
	var goose *AdminPrompt
	for i := range prompts {
		if prompts[i].Day == "2026-11-10" {
			goose = &prompts[i]
		}
	}
	if goose == nil || goose.Submissions != 1 || goose.CreatedBy == nil || goose.CreatedBy.Username != "bob" {
		t.Errorf("goose prompt = %+v", goose)
	}

	subs, err := GetRecentSubmissions(repo, ctx, &config.Config{}, 10)
	if err != nil || len(subs) != 1 || subs[0].Prompt != "a goose" || subs[0].Comments != 1 || subs[0].CreatedAt != "2026-11-10T10:00:00Z" {
		t.Errorf("GetRecentSubmissions = %+v, %v", subs, err)
	}

	log, err := GetActivityLog(repo, ctx, 3)
	if err != nil {
		t.Fatal(err)
	}
	// Newest first; a reaction on a comment points at the comment's drawing and its author
	want := []string{"reaction", "comment", "drawing"}
	for i, kind := range want {
		if log[i].Kind != kind {
			t.Fatalf("log[%d] = %+v, want kind %s", i, log[i], kind)
		}
	}
	if *log[0].SubmissionID != "s1" || *log[0].TargetID != "ann" || log[0].At != "2026-11-10T12:00:00Z" {
		t.Errorf("reaction entry = %+v", log[0])
	}
}

func TestEventStandingsAndReactions(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `
		INSERT INTO users (id, username, email) VALUES ('ann', 'ann', 'a@x.com'), ('bob', 'bob', 'b@x.com'), ('cat', 'cat', 'c@x.com');
		INSERT INTO user_submissions (id, user_id, day) VALUES
			('a1', 'ann', '2026-12-01'), ('a2', 'ann', '2026-12-02'), ('a3', 'ann', '2026-12-30'),
			('b1', 'bob', '2026-12-01'), ('c1', 'cat', '2026-11-01');
		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('bob', 'submission', 'a1', 'snowflake', '2026-12-01 10:00:00'),
			('ann', 'submission', 'a1', 'snowflake', '2026-12-01 11:00:00'),
			('ann', 'submission', 'c1', 'heart', '2026-11-01 10:00:00');`)

	// cat drew before the event, so isn't in it; ann's reaction to herself doesn't count
	standings, err := GetEventStandings(repo, ctx, "2026-11-27", "2026-12-31", "2026-11-27", "2026-12-25")
	if err != nil {
		t.Fatal(err)
	}
	if len(standings) != 2 {
		t.Fatalf("standings = %+v", standings)
	}
	ann := standings[0]
	if ann.User.ID != "ann" || ann.Doodles != 3 || ann.CountdownDoodles != 2 || ann.ReactionsReceived != 1 {
		t.Errorf("ann = %+v", ann)
	}

	from := time.Date(2026, 11, 27, 0, 0, 0, 0, time.UTC)
	to := time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)
	usage, err := GetReactionUsageBetween(repo, ctx, from, to)
	if err != nil || len(usage) != 1 || usage[0].ReactionID != "snowflake" || usage[0].Submissions != 2 {
		t.Errorf("GetReactionUsageBetween = %+v, %v", usage, err)
	}
}

func TestAcceptPromptSuggestion(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `
		INSERT INTO users (id, username, email) VALUES ('ann', 'ann', 'a@x.com');
		INSERT INTO prompt_suggestions (id, user_id, prompt) VALUES ('s1', 'ann', 'a goose'), ('s2', 'ann', 'a duck');
		INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2030-01-02', '[]', 'taken');`)
	colors := []string{"#000000"}

	// A taken day is never replaced, and the suggestion stays on the list
	if err := AcceptPromptSuggestion(repo, ctx, "s2", "2030-01-02", "a duck", colors, nil); !errors.Is(err, ErrDayTaken) {
		t.Errorf("accepting onto a taken day = %v, want ErrDayTaken", err)
	}

	if err := AcceptPromptSuggestion(repo, ctx, "s1", "2030-01-01", "a honking goose", colors, nil); err != nil {
		t.Fatal(err)
	}
	prompt, err := GetDailyPrompt(repo, ctx, "2030-01-01")
	if err != nil || prompt.Prompt != "a honking goose" || prompt.CreatedBy == nil || prompt.CreatedBy.ID != "ann" {
		t.Errorf("scheduled prompt = %+v, %v", prompt, err)
	}

	var left int
	repo.QueryRow(`SELECT COUNT(*) FROM prompt_suggestions`).Scan(&left)
	if left != 1 {
		t.Errorf("%d suggestions left, want 1 (s2)", left)
	}
	if err := AcceptPromptSuggestion(repo, ctx, "s1", "2030-01-03", "again", colors, nil); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("accepting a used suggestion = %v, want sql.ErrNoRows", err)
	}
}
