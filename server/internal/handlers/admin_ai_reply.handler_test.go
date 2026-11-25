package handlers

import (
	"context"
	"drawer-service-backend/internal/ai"
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/queries"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// replyProvider answers every call with answer and keeps the last call it was sent.
type replyProvider struct {
	answer string
	got    *ai.Call
}

func (p replyProvider) Ask(_ context.Context, call ai.Call) (string, error) {
	*p.got = call
	return p.answer, nil
}
func (p replyProvider) Model() string { return "fake" }

func TestAdminAIReply(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	cfg := &config.Config{Env: "development"}
	dbtest.Exec(t, repo, `
		UPDATE ai_settings SET value = 'true' WHERE key = 'enabled';
		INSERT INTO ai_settings (key, value) VALUES ('openai_api_key', 'sk-test');
		INSERT INTO users (id, username, email) VALUES ('ann', 'ann', 'ann@x'), ('bob', 'bob', 'bob@x');
		INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2026-11-10', '[]', 'A goalie');
		INSERT INTO user_submissions (id, user_id, day) VALUES ('reviewed', 'ann', '2026-11-10'), ('unreviewed', 'bob', '2026-11-10');
		INSERT INTO ai_reviews (submission_id, personality_id, status, score, comment) VALUES
			('reviewed', 'ai-sir-doodleton', 'done', 4.5, 'A goalie made of soup.');
		INSERT INTO comments (submission_id, user_id, text, created_at) VALUES
			('reviewed', 'bob', 'Sir Doodleton, that is clearly a goalie', '2026-11-10 10:00:00'),
			('reviewed', 'ann', 'thanks bob', '2026-11-10 10:05:00');`)

	// Outside production the doodle's image is ../public/example.png
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

	var sent ai.Call
	old := ai.NewProvider
	t.Cleanup(func() { ai.NewProvider = old })
	ai.NewProvider = func(ai.Settings) ai.Provider {
		return replyProvider{answer: `{"replies": [{"to": "bob", "comment": "a goalie does not melt."}, {"to": "ann", "comment": "You're welcome."}]}`, got: &sent}
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
	})
	router.POST("/ai/reviews/:submissionId/replies/draft", HandleAdminDraftAIReplies)
	router.POST("/ai/reviews/:submissionId/replies", HandleAdminPostAIReplies)
	router.DELETE("/ai/replies/:id", HandleAdminDeleteAIReply)
	do := func(method, path, body string) (int, string) {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(method, path, strings.NewReader(body)))
		return recorder.Code, recorder.Body.String()
	}
	posted := func() []string {
		replies, err := queries.GetAIReplies(repo, context.Background(), "reviewed")
		if err != nil {
			t.Fatal(err)
		}
		texts := []string{}
		for _, r := range replies {
			texts = append(texts, r.Text)
		}
		return texts
	}

	if code, _ := do("POST", "/ai/reviews/unreviewed/replies/draft", `{}`); code != http.StatusBadRequest {
		t.Errorf("drafting on a doodle with no review: status %d; want 400", code)
	}

	// Drafting writes one @reply per person and posts nothing
	code, body := do("POST", "/ai/reviews/reviewed/replies/draft", `{"direction": "apologize to bob"}`)
	if code != http.StatusOK || body != `{"replies":[{"to":"bob","text":"@bob a goalie does not melt."},{"to":"ann","text":"@ann You're welcome."}]}` {
		t.Fatalf("drafts = %d %s", code, body)
	}
	for _, want := range []string{
		`"A goalie"`, "ann drew", "4.5 out of 10", `"A goalie made of soup."`, "@mention you as @SirDoodleton.",
		`- bob: "Sir Doodleton, that is clearly a goalie"`, `- ann (the artist): "thanks bob"`, "asks you to: apologize to bob\n",
	} {
		if !strings.Contains(sent.User, want) {
			t.Errorf("the judge wasn't told %q:\n%s", want, sent.User)
		}
	}
	if sent.Image == nil || !strings.Contains(sent.System, "Who you are:") {
		t.Errorf("the judge should see the doodle and its character: image %v, system %q", sent.Image != nil, sent.System)
	}
	if got := posted(); len(got) != 0 {
		t.Fatalf("drafting posted %v", got)
	}

	// The admin posts only the ones they approved
	for _, bad := range []string{`{}`, `{"texts": []}`, `{"texts": ["  "]}`} {
		if code, _ := do("POST", "/ai/reviews/reviewed/replies", bad); code != http.StatusBadRequest {
			t.Errorf("posting %s: status %d; want 400", bad, code)
		}
	}
	if code, _ := do("POST", "/ai/reviews/reviewed/replies", `{"texts": ["@bob a goalie does not melt."]}`); code != http.StatusNoContent {
		t.Fatalf("posting: status %d", code)
	}
	if got := posted(); len(got) != 1 || got[0] != "@bob a goalie does not melt." {
		t.Fatalf("posted = %v", got)
	}

	// Drafting again hears the posted reply as its own words
	do("POST", "/ai/reviews/reviewed/replies/draft", `{}`)
	if !strings.Contains(sent.User, `- You: "@bob a goalie does not melt."`) || !strings.Contains(sent.User, "Reply to each person who spoke to you") {
		t.Errorf("second draft's message:\n%s", sent.User)
	}

	replies, _ := queries.GetAIReplies(repo, context.Background(), "reviewed")
	if code, _ := do("DELETE", "/ai/replies/"+replies[0].ID, ""); code != http.StatusNoContent {
		t.Errorf("delete: status %d", code)
	}
	if code, _ := do("DELETE", "/ai/replies/"+replies[0].ID, ""); code != http.StatusNotFound {
		t.Errorf("deleting it again: status %d; want 404", code)
	}
	if got := posted(); len(got) != 0 {
		t.Errorf("left after delete: %v", got)
	}
}
