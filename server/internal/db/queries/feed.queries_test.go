package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"slices"
	"testing"
	"time"
)

func newFeedDB(t *testing.T) *sql.DB {
	t.Helper()
	repo := dbtest.NewEventsDB(t)
	for _, id := range []string{"me", "friend", "stranger"} {
		dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES (?, ?, ?)`, id, id, id+"@example.com")
	}
	dbtest.Exec(t, repo, `INSERT INTO friendships (user1, user2, inviter_id, state) VALUES ('me', 'friend', 'me', 'accepted')`)
	for _, day := range []string{"2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"} {
		dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES (?, '["#000"]', 'a penguin')`, day)
	}
	for _, s := range [][3]string{
		{"me1", "me", "2026-10-01"}, {"me2", "me", "2026-10-02"},
		{"f3", "friend", "2026-10-03"}, {"f5", "friend", "2026-10-05"}, {"f6", "friend", "2026-10-06"},
		// Not in my circle, so never in my feed
		{"x4", "stranger", "2026-10-04"}, {"x6", "stranger", "2026-10-06"},
	} {
		dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES (?, ?, ?)`, s[0], s[1], s[2])
	}
	return repo
}

func ids(subs []*models.UserPromptSubmission) []string {
	var out []string
	for _, s := range subs {
		out = append(out, s.ID)
	}
	return out
}

func TestFeedPages(t *testing.T) {
	repo := newFeedDB(t)
	ctx := context.Background()
	cfg := &config.Config{}

	for _, want := range []struct {
		before, next string
		ids          []string
	}{
		{"", "2026-10-05", []string{"f6", "f5"}},
		{"2026-10-05", "2026-10-02", []string{"f3", "me2"}},
		{"2026-10-02", "", []string{"me1"}},
	} {
		page, err := GetFeedPage(repo, ctx, cfg, "me", want.before, 2)
		if err != nil {
			t.Fatal(err)
		}
		if !slices.Equal(ids(page.Submissions), want.ids) || page.NextBefore != want.next {
			t.Errorf("before %q: got %v next %q, want %v next %q", want.before, ids(page.Submissions), page.NextBefore, want.ids, want.next)
		}
	}

	day, err := GetFeedDay(repo, ctx, cfg, "me", "2026-10-06")
	if err != nil || !slices.Equal(ids(day), []string{"f6"}) {
		t.Errorf("GetFeedDay = %v, %v; want [f6]", ids(day), err)
	}
}

func TestFeedCommentsAndReactions(t *testing.T) {
	repo := newFeedDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO comments (id, submission_id, user_id, text, created_at) VALUES
		(1, 'f6', 'me', 'first', '2026-10-06 10:00:00'),
		(2, 'f6', 'friend', 'second', '2026-10-06 11:00:00')`)
	dbtest.Exec(t, repo, `INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
		('me', 'submission', 'f6', 'heart', '2026-10-06 09:00:00'),
		('me', 'submission', 'f6', 'fire', '2026-10-06 09:01:00'),
		('stranger', 'submission', 'f6', 'fire', '2026-10-06 09:02:00'),
		('friend', 'comment', '1', 'heart', '2026-10-06 12:00:00'),
		('me', 'submission', 'x6', 'fire', '2026-10-06 09:00:00')`)

	subs, err := GetFeedDay(repo, ctx, &config.Config{}, "me", "2026-10-06")
	if err != nil || len(subs) != 1 {
		t.Fatalf("GetFeedDay = %v, %v", ids(subs), err)
	}
	f6 := subs[0]
	if f6.Prompt != "a penguin" || !slices.Equal(f6.Colors, []string{"#000"}) || f6.User.ID != "friend" {
		t.Errorf("submission = %+v", f6)
	}
	if len(f6.Reactions) != 3 || f6.Reactions[0].ReactionID != "heart" || f6.Reactions[2].User.ID != "stranger" {
		t.Errorf("reactions = %+v", f6.Reactions)
	}
	if want := []models.ReactionCount{{ReactionID: "fire", Count: 2}, {ReactionID: "heart", Count: 1}}; !slices.Equal(f6.Counts, want) {
		t.Errorf("counts = %+v, want %+v", f6.Counts, want)
	}
	if len(f6.Comments) != 2 || f6.Comments[0].Text != "first" || f6.Comments[0].User.ID != "me" || f6.Comments[1].Text != "second" {
		t.Fatalf("comments = %+v", f6.Comments)
	}
	first := f6.Comments[0]
	if len(first.Reactions) != 1 || first.Reactions[0].User.ID != "friend" ||
		!slices.Equal(first.Counts, []models.ReactionCount{{ReactionID: "heart", Count: 1}}) {
		t.Errorf("comment reactions = %+v, counts = %+v", first.Reactions, first.Counts)
	}
	if len(f6.Comments[1].Reactions) != 0 || f6.Comments[1].Counts == nil {
		t.Errorf("second comment should have no reactions and empty counts: %+v", f6.Comments[1])
	}
}

// Friends' drawings from today stay hidden until you've drawn yours, as everywhere else
func TestFeedHidesTodayUntilYouDraw(t *testing.T) {
	repo := newFeedDB(t)
	ctx := context.Background()
	today := utils.GetFormattedDate(time.Now())
	dbtest.Exec(t, repo, `INSERT OR IGNORE INTO daily_prompts (day, colors, prompt) VALUES (?, '[]', 'today')`, today)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('ft', 'friend', ?)`, today)

	page, err := GetFeedPage(repo, ctx, &config.Config{}, "me", "", 1)
	if err != nil || !slices.Equal(ids(page.Submissions), []string{"ft"}) {
		t.Fatalf("first page = %v, %v; want today's", ids(page.Submissions), err)
	}
	if page.Submissions[0].ImageUrl != "" {
		t.Error("friend's drawing from today should be hidden before you draw")
	}

	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('mt', 'me', ?)`, today)
	page, err = GetFeedPage(repo, ctx, &config.Config{}, "me", "", 1)
	if err != nil || len(page.Submissions) != 2 || page.Submissions[0].ImageUrl == "" || page.Submissions[1].ImageUrl == "" {
		t.Errorf("after drawing, today's page = %+v, %v", page.Submissions, err)
	}
}
