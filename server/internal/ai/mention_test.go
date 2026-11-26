package ai

import (
	"context"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/queries"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestJudgeAnswersTheFirstMentionOnItsOwn(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	cfg := &config.Config{Env: "development"}
	dbtest.Exec(t, repo, `
		UPDATE ai_settings SET value = 'true' WHERE key = 'enabled';
		INSERT INTO ai_settings (key, value) VALUES ('openai_api_key', 'sk-test');
		INSERT INTO users (id, username, email) VALUES ('ann', 'ann', 'ann@x'), ('bob', 'bob', 'bob@x');
		INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2026-11-10', '[]', 'A goalie');
		INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'ann', '2026-11-10'), ('s2', 'bob', '2026-11-10');
		INSERT INTO ai_reviews (submission_id, personality_id, status, score, comment) VALUES
			('s1', 'ai-sir-doodleton', 'done', 4.5, 'A goalie made of soup.'),
			('s2', 'ai-sir-doodleton', 'done', 6, 'Passable.');
		INSERT INTO comments (submission_id, user_id, text) VALUES
			('s1', 'ann', 'love it'),
			('s1', 'bob', '@SirDoodleton you are wrong, it is a goalie');`)
	useExampleImage(t)

	var sent Call
	fail := false
	old := NewProvider
	t.Cleanup(func() { NewProvider = old })
	NewProvider = func(Settings) Provider {
		return fakeProvider{ask: func(call Call) (string, error) {
			sent = call
			if fail {
				return "", errors.New("model down")
			}
			return `{"replies": [{"to": "bob", "intent": "roast", "comment": "Wrong? One simply cannot."}, {"to": "ann", "intent": "praise", "comment": "Thank you."}]}`, nil
		}}
	}

	// A comment that mentions nobody gets nothing
	if r, err := StartMentionReply(ctx, repo, cfg, "s1", "ann", "love it"); err != nil || r != nil {
		t.Fatalf("answering a plain comment: %v, %v", r, err)
	}

	// The first mention is answered right away, to bob alone
	r, err := StartMentionReply(ctx, repo, cfg, "s1", "bob", "@SirDoodleton you are wrong, it is a goalie")
	if err != nil || r == nil {
		t.Fatalf("didn't start answering the mention: %v", err)
	}
	if pending, _ := queries.AutoReplyPending(repo, ctx, "s1"); !pending {
		t.Error("the reply should show as pending while the judge writes it")
	}
	r.Run()
	if !strings.Contains(sent.User, "bob just @mentioned you") {
		t.Errorf("the judge wasn't told to answer bob:\n%s", sent.User)
	}
	replies, _ := queries.GetAIReplies(repo, ctx, "s1")
	if len(replies) != 1 || replies[0].Text != "@bob Wrong? One simply cannot." {
		t.Fatalf("replies = %+v; want one, to bob", replies)
	}
	if pending, _ := queries.AutoReplyPending(repo, ctx, "s1"); pending {
		t.Error("the reply is posted, so nothing is pending")
	}

	// Later mentions wait for an admin
	if r, err := StartMentionReply(ctx, repo, cfg, "s1", "ann", "@sirdoodleton be nice"); err != nil || r != nil {
		t.Fatalf("a second mention got an automatic reply: %v, %v", r, err)
	}

	// A failed reply gives the doodle's turn back to the next mention
	fail = true
	r, _ = StartMentionReply(ctx, repo, cfg, "s2", "bob", "hey @SirDoodleton")
	if r == nil {
		t.Fatal("didn't start answering on s2")
	}
	r.Run()
	if replies, _ := queries.GetAIReplies(repo, ctx, "s2"); len(replies) != 0 {
		t.Fatalf("a failed reply posted %+v", replies)
	}
	if r, _ := StartMentionReply(ctx, repo, cfg, "s2", "bob", "@SirDoodleton?"); r == nil {
		t.Error("after a failure the next mention should get its turn")
	}

	// With judging off, nobody gets an automatic reply
	dbtest.Exec(t, repo, `DELETE FROM ai_auto_replies; UPDATE ai_settings SET value = 'false' WHERE key = 'enabled'`)
	if r, err := StartMentionReply(ctx, repo, cfg, "s2", "bob", "@SirDoodleton?"); err != nil || r != nil {
		t.Errorf("answered while judging is off: %v, %v", r, err)
	}
}

func TestLostAutoReplyClaimCanBeRetaken(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `
		INSERT INTO users (id, username, email) VALUES ('ann', 'ann', 'ann@x'), ('bob', 'bob', 'bob@x');
		INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2026-11-10', '[]', 'A goalie');
		INSERT INTO user_submissions (id, user_id, day) VALUES ('lost', 'ann', '2026-11-10'), ('done', 'bob', '2026-11-10');
		INSERT INTO ai_auto_replies (submission_id, started_at, replied_at) VALUES
			('lost', datetime('now', '-5 minutes'), NULL),
			('done', datetime('now', '-5 minutes'), datetime('now', '-4 minutes'));`)
	if pending, _ := queries.AutoReplyPending(repo, ctx, "lost"); pending {
		t.Error("a lost claim shouldn't keep the app waiting")
	}
	if ok, err := queries.ClaimAutoReply(repo, ctx, "lost"); err != nil || !ok {
		t.Errorf("a lost claim should be retaken: %v, %v", ok, err)
	}
	if ok, _ := queries.ClaimAutoReply(repo, ctx, "lost"); ok {
		t.Error("a fresh claim can't be taken twice")
	}
	if ok, _ := queries.ClaimAutoReply(repo, ctx, "done"); ok {
		t.Error("a doodle only gets one automatic reply")
	}
}

// useExampleImage stands in for ../public/example.png, the doodle image outside production.
func useExampleImage(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "public"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "public", "example.png"), []byte("png"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(dir, "server"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Chdir(filepath.Join(dir, "server"))
}
