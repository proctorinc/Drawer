package queries

import (
	"context"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/dbtest"
	"testing"
)

func TestAIMentions(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	cfg := &config.Config{Env: "development"}
	dbtest.Exec(t, repo, `
		INSERT INTO users (id, username, email) VALUES ('ann', 'ann', 'ann@x'), ('bob', 'bob', 'bob@x');
		INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2026-11-10', '[]', 'A goalie');
		INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'ann', '2026-11-10'), ('s2', 'bob', '2026-11-10');
		INSERT INTO ai_personalities (id, slug, name, system_prompt) VALUES ('ai-other', 'other', 'Madame Scribble', '');
		INSERT INTO ai_reviews (submission_id, personality_id, status) VALUES ('s1', 'ai-sir-doodleton', 'done');
		INSERT INTO comments (id, submission_id, user_id, text, created_at) VALUES
			(1, 's1', 'bob', 'what do you think @SirDoodleton?', '2026-11-10 10:00:00'),
			(2, 's1', 'bob', 'hey @ann', '2026-11-10 10:01:00'),
			(3, 's1', 'ann', '@sirdoodleton again', '2026-11-10 12:00:00'),
			(4, 's1', 'ann', 'email me at x@SirDoodleton', '2026-11-10 12:01:00'),
			(5, 's1', 'bob', 'what about you @MadameScribble', '2026-11-10 12:02:00'),
			(6, 's2', 'ann', 'no review here @SirDoodleton', '2026-11-10 12:03:00');
		INSERT INTO ai_replies (id, submission_id, personality_id, text, created_at) VALUES
			('r1', 's1', 'ai-sir-doodleton', 'One simply cannot.', '2026-11-10 11:00:00');`)

	mentions, err := ListAIMentions(repo, ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	// Only the reviewer's @mentions count: not another judge's (5), nor any on an unreviewed doodle (6)
	if len(mentions) != 2 || mentions[0].CommentID != 1 || mentions[1].CommentID != 3 {
		t.Fatalf("got %+v; want comments 1 then 3", mentions)
	}
	first, second := mentions[0], mentions[1]
	if first.Judge != "Sir Doodleton" {
		t.Errorf("judge = %q", first.Judge)
	}
	if first.RepliedBy == nil || *first.RepliedBy != "Sir Doodleton" || first.CheckedAt != nil {
		t.Errorf("comment 1 should be answered by the later reply: %+v", first)
	}
	if second.RepliedBy != nil || second.CheckedAt != nil {
		t.Errorf("comment 3 came after the reply and should be open: %+v", second)
	}

	if err := CheckAIMention(repo, ctx, 3, "ann"); err != nil {
		t.Fatal(err)
	}
	if err := CheckAIMention(repo, ctx, 3, "ann"); err != nil {
		t.Fatalf("checking twice: %v", err)
	}
	if err := CheckAIMention(repo, ctx, 99, "ann"); err == nil {
		t.Error("checking a missing comment should fail")
	}
	mentions, _ = ListAIMentions(repo, ctx, cfg)
	if c := mentions[1]; c.CheckedBy == nil || *c.CheckedBy != "ann" || c.CheckedAt == nil {
		t.Errorf("comment 3 should be checked off by ann: %+v", c)
	}

	if err := UncheckAIMention(repo, ctx, 3); err != nil {
		t.Fatal(err)
	}
	mentions, _ = ListAIMentions(repo, ctx, cfg)
	if mentions[1].CheckedAt != nil {
		t.Errorf("comment 3 should be open again: %+v", mentions[1])
	}
}
