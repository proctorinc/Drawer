package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"errors"
	"reflect"
	"testing"
	"time"
)

const (
	christmasFirstDay = "2026-11-27"
	christmasLastDay  = "2026-12-31"
)

func at(value string) time.Time {
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		panic(err)
	}
	return t
}

func addUser(t *testing.T, repo *sql.DB, id string) {
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES (?, ?, ?)`, id, "name-"+id, id+"@example.com")
}

func addFriend(t *testing.T, repo *sql.DB, user1, user2, state string) {
	dbtest.Exec(t, repo, `INSERT INTO friendships (user1, user2, inviter_id, state) VALUES (?, ?, ?, ?)`, user1, user2, user1, state)
}

func addSubmission(t *testing.T, repo *sql.DB, id, userID, day string) {
	dbtest.Exec(t, repo, `INSERT OR IGNORE INTO daily_prompts (day, colors, prompt) VALUES (?, '["#000000"]', 'a prompt')`, day)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES (?, ?, ?)`, id, userID, day)
}

func addReaction(t *testing.T, repo *sql.DB, userID, submissionID, reactionID string) {
	dbtest.Exec(t, repo, `INSERT INTO reactions (user_id, content_type, content_id, reaction_id) VALUES (?, 'submission', ?, ?)`,
		userID, submissionID, reactionID)
}

func TestEventMigrationSeeds(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()

	event, err := GetEventBySlug(repo, ctx, "christmas-2026")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(event.Reactions, []string{"snowflake", "gift"}) {
		t.Errorf("Reactions = %v, want [snowflake gift]", event.Reactions)
	}

	for _, id := range []string{"christmas-2026-first-snow", "christmas-2026-twelve-days", "christmas-2026-doodle-claus"} {
		achievementEvent, err := GetAchievementEvent(repo, ctx, id)
		if err != nil || achievementEvent.Slug != "christmas-2026" {
			t.Errorf("GetAchievementEvent(%s) = %s, %v", id, achievementEvent.Slug, err)
		}
	}

	addUser(t, repo, "me")
	achievements, _, err := GetAchievementsAndRewardsByUserID(repo, ctx, "me")
	if err != nil {
		t.Fatal(err)
	}
	if len(achievements) != 3 {
		t.Fatalf("got %d achievements, want the 3 christmas stickers", len(achievements))
	}
	for _, achievement := range achievements {
		if achievement.EventSlug == nil || *achievement.EventSlug != "christmas-2026" {
			t.Errorf("%s: EventSlug = %v, want christmas-2026", achievement.ID, achievement.EventSlug)
		}
	}
}

func TestChristmasPromptSchedule(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()

	var count int
	if err := repo.QueryRow(`SELECT COUNT(*) FROM daily_prompts WHERE day BETWEEN '2026-11-27' AND '2026-12-25'`).Scan(&count); err != nil || count != 29 {
		t.Fatalf("got %d christmas prompts (%v), want 29", count, err)
	}

	tests := []struct {
		day, prompt string
		colors      []string
	}{
		{"2026-11-27", "leftovers in disguise", []string{"#E5483B", "#2F9E5B", "#FFB400", "#FFF8EC"}},
		{"2026-12-02", "the world's ugliest sweater", []string{"#1F3A5F", "#FFB400", "#9FB6CF", "#F3F6FA"}},
		{"2026-12-03", "a cat versus the christmas tree", []string{"#E5483B", "#2F9E5B", "#FFB400", "#FFF8EC"}},
		{"2026-12-25", "christmas morning", []string{"#6C3FC4", "#FF8FB1", "#FFD45A", "#FFF6FB"}},
	}
	for _, tt := range tests {
		prompt, err := GetDailyPrompt(repo, ctx, tt.day)
		if err != nil {
			t.Fatalf("%s: %v", tt.day, err)
		}
		if prompt.Prompt != tt.prompt || !reflect.DeepEqual(prompt.Colors, tt.colors) {
			t.Errorf("%s: got %q %v, want %q %v", tt.day, prompt.Prompt, prompt.Colors, tt.prompt, tt.colors)
		}
	}

	// Re-running the seed must not overwrite a day an admin scheduled.
	dbtest.Exec(t, repo, `UPDATE daily_prompts SET prompt = 'an admin prompt' WHERE day = '2026-12-01'`)
	dbtest.Exec(t, repo, `DELETE FROM daily_prompts WHERE day = '2026-12-02'`)
	dbtest.ApplyMigration(t, repo, "1795035200_seed_christmas_prompts.up.sql")
	var prompt string
	repo.QueryRow(`SELECT prompt FROM daily_prompts WHERE day = '2026-12-01'`).Scan(&prompt)
	if prompt != "an admin prompt" {
		t.Errorf("admin prompt was overwritten with %q", prompt)
	}
	repo.QueryRow(`SELECT prompt FROM daily_prompts WHERE day = '2026-12-02'`).Scan(&prompt)
	if prompt != "the world's ugliest sweater" {
		t.Errorf("missing day was not re-seeded: %q", prompt)
	}
}

func TestGetUserSubmissionDaysWindow(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	addUser(t, repo, "me")
	addUser(t, repo, "other")
	for id, day := range map[string]string{
		"before": "2026-11-26", "first": "2026-11-27", "middle": "2026-12-10", "last": "2026-12-31", "after": "2027-01-01",
	} {
		addSubmission(t, repo, id, "me", day)
	}
	addSubmission(t, repo, "someone-else", "other", "2026-12-11")

	days, err := GetUserSubmissionDays(repo, context.Background(), "me", christmasFirstDay, christmasLastDay)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"2026-11-27", "2026-12-10", "2026-12-31"}
	if !reflect.DeepEqual(days, want) {
		t.Errorf("days = %v, want %v", days, want)
	}
}

func TestGetEventLeaderboard(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	for _, id := range []string{"me", "friendA", "friendB", "pending", "stranger"} {
		addUser(t, repo, id)
	}
	addFriend(t, repo, "me", "friendA", "accepted")
	addFriend(t, repo, "friendB", "me", "accepted")
	addFriend(t, repo, "me", "pending", "pending")

	// me: 2 event doodles (+1 outside the window), 1 reaction from a friend and 1 self-reaction
	addSubmission(t, repo, "me1", "me", "2026-11-27")
	addSubmission(t, repo, "me2", "me", "2026-11-28")
	addSubmission(t, repo, "me-old", "me", "2026-11-20")
	addReaction(t, repo, "friendA", "me1", "snowflake")
	addReaction(t, repo, "me", "me1", "heart")
	// friendA: 2 event doodles and 2 reactions, so it ties me on doodles and wins on reactions
	addSubmission(t, repo, "a1", "friendA", "2026-12-01")
	addSubmission(t, repo, "a2", "friendA", "2026-12-31")
	addReaction(t, repo, "me", "a1", "gift")
	addReaction(t, repo, "friendB", "a2", "fire")
	// friendB: 3 event doodles, but one is after the event ends
	addSubmission(t, repo, "b1", "friendB", "2026-12-05")
	addSubmission(t, repo, "b2", "friendB", "2026-12-06")
	addSubmission(t, repo, "b3", "friendB", "2026-12-07")
	addSubmission(t, repo, "b-late", "friendB", "2027-01-01")
	addReaction(t, repo, "me", "b-late", "fire")
	// Not friends: excluded
	addSubmission(t, repo, "p1", "pending", "2026-12-05")
	addSubmission(t, repo, "s1", "stranger", "2026-12-05")

	entries, err := GetEventLeaderboard(repo, context.Background(), "me", christmasFirstDay, christmasLastDay)
	if err != nil {
		t.Fatal(err)
	}

	type row struct {
		user                       string
		doodles, reactionsReceived int
	}
	var got []row
	for _, entry := range entries {
		got = append(got, row{entry.User.ID, entry.Doodles, entry.ReactionsReceived})
	}
	want := []row{{"friendB", 3, 0}, {"friendA", 2, 2}, {"me", 2, 1}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("leaderboard = %+v, want %+v", got, want)
	}
	if entries[0].User.Username != "name-friendB" || entries[0].User.Email != "friendB@example.com" {
		t.Errorf("user JSON fields not filled: %+v", entries[0].User)
	}

	received, err := CountReactionsReceived(repo, context.Background(), "friendA", christmasFirstDay, christmasLastDay)
	if err != nil || received != 2 {
		t.Errorf("CountReactionsReceived = %d, %v; want 2", received, err)
	}
}

func TestIsEventReactionAllowed(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()

	tests := []struct {
		reaction string
		now      string
		want     bool
	}{
		{"snowflake", "2026-11-26T23:59:59Z", false},
		{"snowflake", "2026-11-27T00:00:00Z", true},
		{"gift", "2026-12-31T23:59:59Z", true},
		{"gift", "2027-01-01T00:00:00Z", false},
		{"pumpkin", "2026-12-10T00:00:00Z", false},
	}
	for _, tt := range tests {
		got, err := IsEventReactionAllowed(repo, ctx, tt.reaction, at(tt.now))
		if err != nil || got != tt.want {
			t.Errorf("IsEventReactionAllowed(%s, %s) = %v, %v; want %v", tt.reaction, tt.now, got, err, tt.want)
		}
	}
}

func TestClaimEventNotificationOnce(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	event, _ := GetEventBySlug(repo, ctx, "christmas-2026")

	for i, want := range []bool{true, false, false} {
		claimed, err := ClaimEventNotification(repo, ctx, event.ID, "start")
		if err != nil || claimed != want {
			t.Errorf("claim %d = %v, %v; want %v", i, claimed, err, want)
		}
	}
	if claimed, _ := ClaimEventNotification(repo, ctx, event.ID, "end"); !claimed {
		t.Error("a different kind should be claimable")
	}
}

func TestCreateAndUpdateEvent(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()

	days := 3
	created, err := CreateEvent(repo, ctx, models.Event{
		Slug: "spooky-2027", Name: "Spooky", Theme: "halloween",
		StartsAt: at("2027-10-29T00:00:00Z"), EndsAt: at("2027-11-01T00:00:00Z"),
		CountdownDays: &days, Reactions: []string{"pumpkin"},
	})
	if err != nil {
		t.Fatal(err)
	}

	if taken, _ := IsEventSlugTaken(repo, ctx, "spooky-2027", ""); !taken {
		t.Error("slug should be taken")
	}
	if taken, _ := IsEventSlugTaken(repo, ctx, "spooky-2027", created.ID); taken {
		t.Error("an event's own slug shouldn't count as taken")
	}
	if allowed, _ := IsEventReactionAllowed(repo, ctx, "pumpkin", at("2027-10-30T00:00:00Z")); !allowed {
		t.Error("pumpkin should be allowed during the new event")
	}

	created.Name = "Spookier"
	created.CountdownDays = nil
	created.Reactions = []string{"ghost", "bat"}
	if err := UpdateEvent(repo, ctx, created); err != nil {
		t.Fatal(err)
	}
	updated, err := GetEventBySlug(repo, ctx, "spooky-2027")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "Spookier" || updated.CountdownDays != nil || !reflect.DeepEqual(updated.Reactions, []string{"ghost", "bat"}) {
		t.Errorf("unexpected update result %+v", updated)
	}

	created.ID = "missing"
	if err := UpdateEvent(repo, ctx, created); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("updating a missing event: got %v, want sql.ErrNoRows", err)
	}

	list, err := ListEvents(repo, ctx)
	if err != nil || len(list) != 2 || list[0].Slug != "spooky-2027" {
		t.Errorf("ListEvents = %+v, %v", list, err)
	}
}

func TestGetUserSubmissionsInDays(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	addUser(t, repo, "me")
	addUser(t, repo, "friend")
	addSubmission(t, repo, "late", "me", "2026-12-03")
	addSubmission(t, repo, "early", "me", "2026-11-28")
	addSubmission(t, repo, "outside", "me", "2026-11-01")
	addReaction(t, repo, "friend", "early", "snowflake")
	dbtest.Exec(t, repo, `INSERT INTO comments (submission_id, user_id, text) VALUES ('early', 'friend', 'nice')`)

	submissions, err := GetUserSubmissionsInDays(repo, ctx, &config.Config{Env: "development"}, "me", christmasFirstDay, christmasLastDay)
	if err != nil {
		t.Fatal(err)
	}
	if len(submissions) != 2 || submissions[0].ID != "early" || submissions[1].ID != "late" {
		t.Fatalf("got %+v, want early then late", submissions)
	}
	early := submissions[0]
	if early.Prompt != "a snowman's first day" || len(early.Colors) != 4 || early.User.ID != "me" {
		t.Errorf("unexpected submission %+v", early)
	}
	if len(early.Reactions) != 1 || early.Reactions[0].ReactionID != "snowflake" || len(early.Counts) != 1 {
		t.Errorf("reactions = %+v, counts = %+v", early.Reactions, early.Counts)
	}
	if len(early.Comments) != 1 || early.Comments[0].Text != "nice" || early.Comments[0].Reactions == nil {
		t.Errorf("comments = %+v", early.Comments)
	}
}
