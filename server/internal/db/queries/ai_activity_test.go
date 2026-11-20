package queries

import (
	"context"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"testing"
)

func TestGetAIReviewActivity(t *testing.T) {
	db := dbtest.NewEventsDB(t)
	dbtest.Exec(t, db, `
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO daily_prompts (day, colors, prompt) VALUES
			('2026-11-10', '[]', 'A goalie'), ('2026-11-11', '[]', 'A banana'), ('2026-11-12', '[]', 'A pear');
		INSERT INTO user_submissions (id, user_id, day) VALUES
			('done', 'me', '2026-11-10'), ('pending', 'me', '2026-11-11'),
			('old', 'me', '2026-11-12'), ('pals', 'pal', '2026-11-10');
		INSERT INTO ai_reviews (submission_id, personality_id, status, score, comment, updated_at) VALUES
			('done', 'ai-sir-doodleton', 'done', 6.5, 'One simply cannot.', datetime('now', '-1 hours')),
			('pending', 'ai-sir-doodleton', 'pending', NULL, '', datetime('now')),
			('old', 'ai-sir-doodleton', 'done', 3, 'Ancient.', datetime('now', '-8 days')),
			('pals', 'ai-sir-doodleton', 'done', 9, 'Not yours.', datetime('now'));`)

	got, err := GetAIReviewActivity(db, context.Background(), "me", &config.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d rows, want only my finished review from this week: %+v", len(got), got)
	}
	a := got[0]
	if a.Action != models.ActivityActionAIReview || a.ID != "ai-review-done" || a.User.ID != "me" {
		t.Errorf("activity = %+v", a)
	}
	if a.AIReview == nil || a.AIReview.Judge.Name != "Sir Doodleton" || *a.AIReview.Score != 6.5 || a.AIReview.Comment != "One simply cannot." {
		t.Errorf("review = %+v", a.AIReview)
	}
	if a.Submission == nil || a.Submission.Prompt != "A goalie" || a.Date.IsZero() {
		t.Errorf("submission = %+v, date %v", a.Submission, a.Date)
	}
}

func TestMarkAIReviewHeard(t *testing.T) {
	db := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, db, `
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2026-11-10', '[]', 'A goalie');
		INSERT INTO user_submissions (id, user_id, day) VALUES ('mine', 'me', '2026-11-10');
		INSERT INTO ai_reviews (submission_id, personality_id, status, score, comment) VALUES
			('mine', 'ai-sir-doodleton', 'done', 6, 'Hm.');`)
	heard := func() bool {
		got, err := GetAIReviewActivity(db, ctx, "me", &config.Config{})
		if err != nil || len(got) != 1 {
			t.Fatalf("activity = %+v, %v", got, err)
		}
		return got[0].AIReview.Heard
	}

	if heard() {
		t.Fatal("a new review shouldn't be heard yet")
	}
	if err := MarkAIReviewHeard(db, ctx, "mine", "pal"); err != nil || heard() {
		t.Fatalf("someone else marked my review heard (%v)", err)
	}
	if err := MarkAIReviewHeard(db, ctx, "mine", "me"); err != nil || !heard() {
		t.Fatalf("marking my review heard didn't stick (%v)", err)
	}

	// Judged again: a new comment to hear
	judge, _ := GetAIPersonality(db, ctx, "ai-sir-doodleton")
	if err := StartAIReview(db, ctx, "mine", judge); err != nil {
		t.Fatal(err)
	}
	if err := FinishAIReview(db, ctx, "mine", 7, nil, "Better.", "test"); err != nil {
		t.Fatal(err)
	}
	if heard() {
		t.Error("a re-judged review should be unheard again")
	}
}
