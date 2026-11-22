package ai

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// The real roll, kept for the test that checks it
var realRollSwing = rollSwing

// Judging runs in these tests never get a random swing, so their scores stay predictable
func TestMain(m *testing.M) {
	rollSwing = func() Swing { return Swing{} }
	os.Exit(m.Run())
}

func santa() models.AIPersonality {
	return models.AIPersonality{
		ID: "santa", Name: "Santa", SystemPrompt: "You are Santa.",
		Criteria: []models.AICriterion{
			{ID: "nice", Name: "nice list", Description: "Effort."},
			{ID: "spirit", Name: "christmas spirit", Description: "Festive."},
		},
	}
}

func critic() models.AIPersonality {
	return models.AIPersonality{ID: "critic", Name: "Critic", SystemPrompt: "You are a critic."}
}

func TestParseVerdictOverallOnly(t *testing.T) {
	v, err := ParseVerdict(`{"score": 14, "comment": "  A  triumph.  "}`, critic(), Swing{})
	if err != nil {
		t.Fatal(err)
	}
	if v.Score != 10 {
		t.Errorf("score = %v, want clamped to 10", v.Score)
	}
	if v.Comment != "A triumph." {
		t.Errorf("comment = %q", v.Comment)
	}
	if len(v.Criteria) != 0 {
		t.Errorf("criteria = %v, want none", v.Criteria)
	}
}

func TestParseVerdictAveragesCriteria(t *testing.T) {
	// 8 and 10 (clamped from 12) average to 9, whatever overall score the model gave
	v, err := ParseVerdict(`{"criteria": [{"id": "spirit", "score": 12}, {"id": "nice", "score": 8}], "score": 2, "comment": "Ho ho ho!"}`, santa(), Swing{})
	if err != nil {
		t.Fatal(err)
	}
	if v.Score != 9 {
		t.Errorf("score = %v, want 9", v.Score)
	}
	if len(v.Criteria) != 2 || v.Criteria[0].ID != "nice" || v.Criteria[0].Score != 8 || v.Criteria[1].Score != 10 {
		t.Errorf("criteria = %+v, want nice=8 then spirit clamped to 10", v.Criteria)
	}
	if v.Criteria[1].Name != "christmas spirit" {
		t.Errorf("criteria should snapshot their names, got %+v", v.Criteria[1])
	}
}

func TestParseVerdictFillsSkippedCriteria(t *testing.T) {
	v, err := ParseVerdict(`{"criteria": [{"id": "nice", "score": 0}], "score": 5, "comment": "Hmm."}`, santa(), Swing{})
	if err != nil {
		t.Fatal(err)
	}
	if v.Criteria[0].Score != 1 || v.Criteria[1].Score != 5 {
		t.Errorf("criteria = %+v, want nice clamped to 1 and spirit defaulted to 5", v.Criteria)
	}
	if v.Score != 3 {
		t.Errorf("score = %v, want (1 + 5) / 2 = 3", v.Score)
	}
}

func TestParseVerdictRoundsToOneDecimal(t *testing.T) {
	three := santa()
	three.Criteria = append(three.Criteria, models.AICriterion{ID: "craft", Name: "craft"})
	v, err := ParseVerdict(`{"criteria": [{"id": "nice", "score": 8}, {"id": "spirit", "score": 7}, {"id": "craft", "score": 7}], "score": 1, "comment": "Hm."}`, three, Swing{})
	if err != nil {
		t.Fatal(err)
	}
	if v.Score != 7.3 {
		t.Errorf("score = %v, want 22 / 3 rounded to 7.3", v.Score)
	}
}

func TestParseVerdictRejectsBadAnswers(t *testing.T) {
	for _, raw := range []string{`not json`, `{"score": 5, "comment": "   "}`} {
		if _, err := ParseVerdict(raw, critic(), Swing{}); err == nil {
			t.Errorf("ParseVerdict(%q) should fail", raw)
		}
	}
}

func TestTrimCommentCutsRambling(t *testing.T) {
	long := strings.Repeat("blah ", 100)
	got := trimComment(long)
	if len([]rune(got)) > maxCommentChars+1 || !strings.HasSuffix(got, "…") {
		t.Errorf("trimComment gave %d runes: %q", len([]rune(got)), got)
	}
}

func TestSystemPromptListsCriteria(t *testing.T) {
	prompt := SystemPrompt(santa())
	for _, want := range []string{"You are Santa.", `nice: "nice list". Effort.`, `spirit: "christmas spirit". Festive.`, "from 1 (dreadful) to 10", "Stay fully in character", "never mention any of it in your comment", "Find one specific, concrete thing in this drawing", "Roast or tease the artist"} {
		if !strings.Contains(prompt, want) {
			t.Errorf("system prompt is missing %q:\n%s", want, prompt)
		}
	}
	if strings.Contains(SystemPrompt(critic()), "by id") {
		t.Error("a judge without criteria shouldn't be asked to score criteria")
	}
}

func TestResponseSchema(t *testing.T) {
	schema := ResponseSchema(critic())
	if got := schema["required"]; strings.Join(got.([]string), ",") != "seen,missing,prompt,effort,score,comment" {
		t.Errorf("required = %v", got)
	}
	schema = ResponseSchema(santa())
	if got := schema["required"]; strings.Join(got.([]string), ",") != "seen,missing,prompt,effort,criteria,score,comment" {
		t.Errorf("required = %v", got)
	}

	// The properties go out in order, so the model looks before it scores
	raw, err := json.Marshal(schema)
	if err != nil {
		t.Fatal(err)
	}
	order := []string{`"seen"`, `"missing"`, `"prompt"`, `"effort"`, `"criteria"`, `"score"`, `"comment"`}
	at := -1
	for _, key := range order {
		i := strings.Index(string(raw), key)
		if i < at {
			t.Fatalf("schema properties out of order, want %v:\n%s", order, raw)
		}
		at = i
	}
	var decoded struct {
		Properties struct {
			Criteria struct {
				Items struct {
					Properties struct {
						ID struct {
							Enum []string `json:"enum"`
						} `json:"id"`
					} `json:"properties"`
				} `json:"items"`
			} `json:"criteria"`
		} `json:"properties"`
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if ids := decoded.Properties.Criteria.Items.Properties.ID.Enum; strings.Join(ids, ",") != "nice,spirit" {
		t.Errorf("criterion ids = %v", ids)
	}
}

func TestParseVerdictEffortPenalty(t *testing.T) {
	cases := []struct {
		text        string
		want        float64
		wantPenalty float64
	}{
		{"real", 8, 0},
		{"low", 6, 0.25},   // 25% off 8
		{"none", 4, 0.5},   // Half off 8
		{"nonsense", 8, 0}, // Unknown answers count as a real attempt
	}
	for _, c := range cases {
		v, err := ParseVerdict(`{"seen": " a cat ", "effort": "`+c.text+`", "criteria": [{"id": "nice", "score": 7}, {"id": "spirit", "score": 9}], "score": 1, "comment": "Hm."}`, santa(), Swing{})
		if err != nil {
			t.Fatal(err)
		}
		if v.Score != c.want || v.EffortPenalty != c.wantPenalty {
			t.Errorf("text %q: score %v (penalty %v), want %v (%v)", c.text, v.Score, v.EffortPenalty, c.want, c.wantPenalty)
		}
		// The criteria stay as the judge gave them: the penalty is hidden
		if v.Criteria[0].Score != 7 || v.Criteria[1].Score != 9 {
			t.Errorf("text %q changed the criteria: %+v", c.text, v.Criteria)
		}
		if v.Seen != "a cat" {
			t.Errorf("seen = %q", v.Seen)
		}
	}

	// Never below 1
	v, _ := ParseVerdict(`{"effort": "none", "score": 1, "comment": "Blank."}`, critic(), Swing{})
	if v.Score != 0.5 {
		t.Errorf("score = %v, want half of 1", v.Score)
	}
}

func TestParseVerdictPromptBonus(t *testing.T) {
	cases := []struct {
		prompt     string
		wantNice   float64
		wantSpirit float64
		wantScore  float64
		wantPrompt string
		wantBonus  float64
	}{
		{"nailed", 7.7, 9.5, 8.6, PromptNailed, 0.5},
		{"complete", 7.2, 9, 8.1, PromptComplete, 0},
		{"partial", 5.7, 7.5, 6.6, PromptPartial, -1.5},
		{"missed", 4.2, 6, 5.1, PromptMissed, -3},
		{"nonsense", 7.2, 9, 8.1, PromptComplete, 0}, // Unknown answers count as complete
	}
	for _, c := range cases {
		v, err := ParseVerdict(`{"missing": " the hat ", "prompt": "`+c.prompt+`", "effort": "real", "criteria": [{"id": "nice", "score": 7.24}, {"id": "spirit", "score": 9}], "score": 1, "comment": "Hm."}`, santa(), Swing{})
		if err != nil {
			t.Fatal(err)
		}
		if v.Criteria[0].Score != c.wantNice || v.Criteria[1].Score != c.wantSpirit || v.Score != c.wantScore {
			t.Errorf("prompt %q: criteria %v, %v and score %v; want %v, %v and %v", c.prompt, v.Criteria[0].Score, v.Criteria[1].Score, v.Score, c.wantNice, c.wantSpirit, c.wantScore)
		}
		if v.Prompt != c.wantPrompt || v.PromptBonus != c.wantBonus || v.PromptMissing != "the hat" {
			t.Errorf("prompt %q: got %q (%v, missing %q)", c.prompt, v.Prompt, v.PromptBonus, v.PromptMissing)
		}
	}

	// Without criteria the overall score moves, and scores stay within 1..10
	if v, _ := ParseVerdict(`{"prompt": "partial", "score": 6.66, "comment": "Hm."}`, critic(), Swing{}); v.Score != 5.2 {
		t.Errorf("score = %v, want 6.7 - 1.5 = 5.2", v.Score)
	}
	if v, _ := ParseVerdict(`{"prompt": "nailed", "score": 9.8, "comment": "Wow."}`, critic(), Swing{}); v.Score != 10 {
		t.Errorf("score = %v, want capped at 10", v.Score)
	}
	if v, _ := ParseVerdict(`{"prompt": "missed", "score": 2, "comment": "Eh."}`, critic(), Swing{}); v.Score != 0 {
		t.Errorf("score = %v, want 2 - 3 floored at 0, never negative", v.Score)
	}
}

func TestParseVerdictSwing(t *testing.T) {
	// A loved doodle can reach the top; a hated one with a missed prompt bottoms out at 0
	v, _ := ParseVerdict(`{"prompt": "complete", "criteria": [{"id": "nice", "score": 8.5}, {"id": "spirit", "score": 9.2}], "score": 1, "comment": "Wow."}`, santa(), Swing{Kind: SwingBoost, Points: 1.8})
	if v.Criteria[0].Score != 10 || v.Criteria[1].Score != 10 || v.Score != 10 || v.Swing.Points != 1.8 {
		t.Errorf("loved: criteria %+v, score %v, swing %v; want 10, 10 and 10", v.Criteria, v.Score, v.Swing)
	}
	v, _ = ParseVerdict(`{"prompt": "missed", "criteria": [{"id": "nice", "score": 4}, {"id": "spirit", "score": 6}], "score": 1, "comment": "Ugh."}`, santa(), Swing{Kind: SwingBoost, Points: -2})
	if v.Criteria[0].Score != 0 || v.Criteria[1].Score != 1 || v.Score != 0.5 {
		t.Errorf("hated: criteria %v, %v and score %v; want 0, 1 and 0.5", v.Criteria[0].Score, v.Criteria[1].Score, v.Score)
	}
}

func TestUserPromptTellsTheJudgeAboutASwing(t *testing.T) {
	cases := []struct {
		swing Swing
		want  string
	}{
		{Swing{}, ""},
		{Swing{Kind: SwingBoost, Points: 1.2}, "LOVE"},
		{Swing{Kind: SwingBoost, Points: -1.2}, "HATE"},
		{Swing{Kind: SwingSuper, Points: 3.5}, "OBSESSED"},
		{Swing{Kind: SwingSuper, Points: -3.5}, "WORST"},
	}
	for _, c := range cases {
		got := UserPrompt("a cat", c.swing)
		for _, feeling := range []string{"LOVE", "HATE", "OBSESSED", "WORST"} {
			if strings.Contains(got, feeling) != (feeling == c.want) {
				t.Errorf("swing %+v: %q", c.swing, got)
			}
		}
		if strings.Contains(strings.ToLower(got), "score") || strings.Contains(got, "point") {
			t.Errorf("the judge should only hear how it feels, not about scores: %q", got)
		}
	}
}

func TestRollSwingIsRareAndInRange(t *testing.T) {
	const rolls = 100000
	counts := map[string]int{}
	for range rolls {
		s := realRollSwing()
		counts[s.Kind]++
		if s.Kind == SwingNone {
			if s.Points != 0 {
				t.Fatalf("no swing with %v points", s.Points)
			}
			continue
		}
		for _, tier := range SwingTiers {
			if tier.Kind == s.Kind {
				if a := math.Abs(s.Points); a < tier.Min || a > tier.Max {
					t.Fatalf("%s swing %v is outside %v..%v", s.Kind, s.Points, tier.Min, tier.Max)
				}
			}
		}
	}
	for _, tier := range SwingTiers {
		want := tier.Chance * rolls
		if got := float64(counts[tier.Kind]); got < want*0.8 || got > want*1.2 {
			t.Errorf("%d %s swings in %d rolls, want about %v", counts[tier.Kind], tier.Kind, rolls, want)
		}
	}
}

func TestRunLogsTheSwing(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	rollSwing = func() Swing { return Swing{Kind: SwingSuper, Points: -3.4} }
	t.Cleanup(func() { rollSwing = func() Swing { return Swing{} } })

	var asked Request
	provider := fakeProvider{judge: func(req Request) (string, error) {
		asked = req
		return `{"prompt": "partial", "missing": "the hat", "effort": "real", "score": 8, "comment": "Hm."}`, nil
	}}
	verdict, _, err := RunAndLog(context.Background(), repo, provider, Request{Personality: critic(), Prompt: "a cat in a hat"}, RunMeta{Kind: queries.AIRunTest})
	if err != nil {
		t.Fatal(err)
	}
	if asked.Swing.Kind != SwingSuper || !strings.Contains(UserPrompt(asked.Prompt, asked.Swing), "WORST") {
		t.Errorf("the judge wasn't told it hates it: %+v", asked.Swing)
	}
	if verdict.Score != 3.1 { // 8 - 1.5 for the prompt - 3.4 for the swing
		t.Errorf("score = %v, want 3.1", verdict.Score)
	}
	runs, err := queries.ListAIRuns(repo, context.Background(), 1)
	if err != nil || len(runs) != 1 {
		t.Fatalf("runs = %v, %v", runs, err)
	}
	want := queries.AIRunMetadata{Effort: "real", Prompt: "partial", PromptMissing: "the hat", PromptBonus: -1.5, Swing: "super", SwingPoints: -3.4}
	if runs[0].Metadata != want {
		t.Errorf("metadata = %+v, want %+v", runs[0].Metadata, want)
	}
}

func TestOpenAIJudge(t *testing.T) {
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" || r.Header.Get("Authorization") != "Bearer sk-test" {
			t.Errorf("unexpected request %s %s", r.URL.Path, r.Header.Get("Authorization"))
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)
		w.Write([]byte(`{"choices": [{"message": {"content": "{\"score\": 7, \"comment\": \"Bold.\"}"}, "finish_reason": "stop"}]}`))
	}))
	defer server.Close()

	client := NewOpenAI("sk-test", "")
	client.BaseURL = server.URL
	raw, err := client.Judge(context.Background(), Request{Personality: critic(), Prompt: "a banana", Image: []byte("png")})
	if err != nil {
		t.Fatal(err)
	}
	if raw != `{"score": 7, "comment": "Bold."}` {
		t.Errorf("raw = %q", raw)
	}
	if got["model"] != DefaultOpenAIModel {
		t.Errorf("model = %v", got["model"])
	}
	format := got["response_format"].(map[string]any)
	if format["type"] != "json_schema" {
		t.Errorf("response_format = %v", format)
	}
	user := got["messages"].([]any)[1].(map[string]any)["content"].([]any)
	image := user[1].(map[string]any)["image_url"].(map[string]any)["url"].(string)
	if !strings.HasPrefix(image, "data:image/png;base64,") {
		t.Errorf("image url = %q", image)
	}
	if !strings.Contains(user[0].(map[string]any)["text"].(string), `"a banana"`) {
		t.Errorf("user text = %v", user[0])
	}
}

func TestOpenAIJudgeErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error": {"message": "Incorrect API key provided"}}`))
	}))
	defer server.Close()

	client := NewOpenAI("sk-bad", "gpt-test")
	client.BaseURL = server.URL
	_, err := client.Judge(context.Background(), Request{Personality: critic()})
	if err == nil || !strings.Contains(err.Error(), "Incorrect API key") {
		t.Errorf("err = %v", err)
	}

	if _, err := NewOpenAI("", "").Judge(context.Background(), Request{}); err == nil {
		t.Error("judging without a key should fail")
	}
}

type fakeProvider struct {
	answer string
	err    error
	judge  func(Request) (string, error) // Answers instead, when set
}

func (f fakeProvider) Judge(_ context.Context, req Request) (string, error) {
	if f.judge != nil {
		return f.judge(req)
	}
	return f.answer, f.err
}
func (f fakeProvider) Model() string { return "fake" }

func TestPickAIPersonality(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()

	p, err := queries.PickAIPersonality(repo, ctx, "", "")
	if err != nil || p.ID != "ai-sir-doodleton" {
		t.Fatalf("everyday judge = %v, %v; want Sir Doodleton", p.ID, err)
	}
	if len(p.Criteria) != 3 || p.Criteria[0].Name != "skill" || p.Criteria[1].Name != "recognizability" || p.Criteria[2].Name != "composition" {
		t.Errorf("Sir Doodleton's criteria = %+v; want skill, recognizability and composition", p.Criteria)
	}
	if !strings.HasSuffix(p.SystemPrompt, "like a critic who has suffered greatly for this.") {
		t.Errorf("Sir Doodleton should roast in his comments:\n%s", p.SystemPrompt)
	}
	for _, slug := range []string{"professor-pickles", "santa"} {
		other, _ := queries.GetAIPersonality(repo, ctx, "ai-"+slug)
		if !strings.Contains(other.SystemPrompt, "Your comment is") {
			t.Errorf("%s has no comment style:\n%s", slug, other.SystemPrompt)
		}
	}
	if strings.Contains(p.SystemPrompt, "two things only") || !strings.Contains(p.SystemPrompt, "composition") {
		t.Errorf("Sir Doodleton's prompt should judge on three things:\n%s", p.SystemPrompt)
	}
	pickles, err := queries.GetAIPersonality(repo, ctx, "ai-professor-pickles")
	if err != nil || !pickles.Enabled || pickles.IsDefault || len(pickles.Criteria) != 3 {
		t.Errorf("Professor Pickles = %+v, %v; want an enabled, non-default judge with 3 criteria", pickles, err)
	}
	// Looked up by slug, as production gives events random ids
	event, err := queries.GetEventBySlug(repo, ctx, "christmas-2026")
	if err != nil {
		t.Fatal(err)
	}
	p, err = queries.PickAIPersonality(repo, ctx, event.ID, "")
	if err != nil || p.ID != "ai-santa" || len(p.Criteria) != 3 {
		t.Fatalf("event judge = %v (%d criteria), %v; want Santa with 3", p.ID, len(p.Criteria), err)
	}

	// A judge picked for the day beats the event's judge, on that day only
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2026-12-05', '[]', 'a goose') ON CONFLICT (day) DO NOTHING`)
	dbtest.Exec(t, repo, `UPDATE daily_prompts SET judge_id = 'ai-professor-pickles' WHERE day = '2026-12-05'`)
	if p, _ = queries.PickAIPersonality(repo, ctx, event.ID, "2026-12-05"); p.ID != "ai-professor-pickles" {
		t.Errorf("on a day handed to Professor Pickles, judge = %v", p.ID)
	}
	if p, _ = queries.PickAIPersonality(repo, ctx, event.ID, "2026-12-06"); p.ID != "ai-santa" {
		t.Errorf("on the next day, judge = %v; want Santa", p.ID)
	}
	// A switched-off pick falls back as usual
	dbtest.Exec(t, repo, `UPDATE ai_personalities SET enabled = 0 WHERE id = 'ai-professor-pickles'`)
	if p, _ = queries.PickAIPersonality(repo, ctx, event.ID, "2026-12-05"); p.ID != "ai-santa" {
		t.Errorf("with Professor Pickles off, judge = %v; want Santa", p.ID)
	}

	// Switched off, the event falls back to the default judge
	dbtest.Exec(t, repo, `UPDATE ai_personalities SET enabled = 0 WHERE id = 'ai-santa'`)
	if p, _ = queries.PickAIPersonality(repo, ctx, event.ID, ""); p.ID != "ai-sir-doodleton" {
		t.Errorf("with Santa off, judge = %v; want Sir Doodleton", p.ID)
	}
	dbtest.Exec(t, repo, `UPDATE ai_personalities SET enabled = 0`)
	if _, err = queries.PickAIPersonality(repo, ctx, "", ""); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("with every judge off, err = %v; want no rows", err)
	}
}

func TestReviewSavesAndShowsOnlyFinishedReviews(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'u1', 'u1@example.com')`)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'u1', '2026-12-01'), ('s2', 'u1', '2026-12-02')`)

	p, err := queries.GetAIPersonality(repo, ctx, "ai-santa")
	if err != nil {
		t.Fatal(err)
	}
	answer := `{"criteria": [{"id": "ai-santa-nice-list", "score": 10}, {"id": "ai-santa-christmas-spirit", "score": 9}, {"id": "ai-santa-workshop-quality", "score": 7}], "score": 1, "comment": "That doesn't look like my reindeer!"}`
	if _, err := Review(ctx, repo, fakeProvider{answer: answer}, "s1", Request{Personality: p}, RunMeta{Kind: queries.AIRunRerun, UserID: "u1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := Review(ctx, repo, fakeProvider{err: errors.New("boom")}, "s2", Request{Personality: p}, RunMeta{Kind: queries.AIRunRerun, UserID: "u1"}); err == nil {
		t.Fatal("a failing provider should fail the review")
	}

	subs := []*models.UserPromptSubmission{{ID: "s1"}, {ID: "s2"}}
	if err := queries.AttachAIReviews(repo, ctx, subs); err != nil {
		t.Fatal(err)
	}
	review := subs[0].AIReview
	if review == nil || review.Status != models.AIReviewDone || *review.Score != 8.7 || review.Judge.Name != "Santa" {
		t.Fatalf("review of s1 = %+v; want Santa's done review scoring 8.7", review)
	}
	if len(review.Criteria) != 3 || review.Criteria[2].ImageURL != "/reactions/gift.svg" {
		t.Errorf("criteria = %+v", review.Criteria)
	}
	if subs[1].AIReview != nil {
		t.Errorf("players shouldn't see a failed review, got %+v", subs[1].AIReview)
	}

	admin, err := queries.ListRecentAIReviews(repo, ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(admin) != 2 {
		t.Fatalf("admin sees %d reviews, want 2", len(admin))
	}
	for _, r := range admin {
		if r.SubmissionID == "s2" && (r.Status != models.AIReviewFailed || r.Error != "boom") {
			t.Errorf("admin view of s2 = %+v; want failed with its error", r)
		}
	}
}

func TestSaveAIPersonalityKeepsOneDefault(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()

	saved, err := queries.SaveAIPersonality(repo, ctx, models.AIPersonality{
		Slug: "grump", Name: "Grump", SystemPrompt: "Grumpy.", IsDefault: true, Enabled: true,
		Criteria: []models.AICriterion{{Name: "effort"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if saved.ID == "" || len(saved.Criteria) != 1 || saved.Criteria[0].ID == "" {
		t.Fatalf("saved = %+v", saved)
	}
	old, _ := queries.GetAIPersonality(repo, ctx, "ai-sir-doodleton")
	if old.IsDefault {
		t.Error("the old default should no longer be the default")
	}

	// Editing keeps criterion ids, so old reviews still line up
	criterionID := saved.Criteria[0].ID
	saved.Name = "Grumpier"
	saved, err = queries.SaveAIPersonality(repo, ctx, saved)
	if err != nil || saved.Name != "Grumpier" || saved.Criteria[0].ID != criterionID {
		t.Errorf("after edit: %+v, %v", saved, err)
	}

	if err := queries.DeleteAIPersonality(repo, ctx, saved.ID); err != nil {
		t.Errorf("deleting an unused judge: %v", err)
	}
}

func TestNewSubmissionReviewOnlyWhenSwitchedOn(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'u1', 'u1@example.com')`)
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2026-06-01', '[]', 'a banana')`)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'u1', '2026-06-01')`)

	var gotPrompt, gotJudge string
	old := NewProvider
	NewProvider = func(Settings) Provider {
		return recordingProvider{answer: `{"criteria": [{"id": "ai-sir-doodleton-skill", "score": 2}, {"id": "ai-sir-doodleton-recognizability", "score": 4}, {"id": "ai-sir-doodleton-composition", "score": 3}], "score": 9, "comment": "A banana? I see a boomerang."}`, prompt: &gotPrompt, judge: &gotJudge}
	}
	t.Cleanup(func() { NewProvider = old })

	cfg := &config.Config{Env: "development", OpenAIAPIKey: "sk-env", EventsFakeNow: "2026-06-01"}

	// Off by default (the seed leaves it off), even with a key in the environment: no
	// review, not even a pending one, so the doodle shows no AI UI
	review, err := StartNewSubmissionReview(ctx, repo, cfg, "s1")
	if err != nil || review != nil {
		t.Fatalf("started a review while switched off: %v, %v", review, err)
	}
	if reviews, _ := queries.ListRecentAIReviews(repo, ctx, 10); len(reviews) != 0 {
		t.Fatalf("recorded a review while switched off: %+v", reviews)
	}

	if err := queries.SetAISettings(repo, ctx, map[string]string{SettingEnabled: "true"}); err != nil {
		t.Fatal(err)
	}
	review, err = StartNewSubmissionReview(ctx, repo, cfg, "s1")
	if err != nil || review == nil {
		t.Fatalf("didn't start a review while switched on: %v", err)
	}

	// Pending as soon as it's started, before the model has answered
	reviews, _ := queries.GetAIReviews(repo, ctx, []string{"s1"})
	if got := reviews["s1"]; got.Status != models.AIReviewPending {
		t.Fatalf("before running, review = %+v; want pending", got)
	}

	review.Run([]byte("png"))
	reviews, _ = queries.GetAIReviews(repo, ctx, []string{"s1"})
	got, ok := reviews["s1"]
	if !ok || got.Status != models.AIReviewDone || *got.Score != 3 || got.Judge.Name != "Sir Doodleton" {
		t.Fatalf("review = %+v", got)
	}
	if gotPrompt != "a banana" || gotJudge != "Sir Doodleton" {
		t.Errorf("provider got prompt %q from %q", gotPrompt, gotJudge)
	}

	// Switching judging off later keeps the reviews already written
	if err := queries.SetAISettings(repo, ctx, map[string]string{SettingEnabled: "false"}); err != nil {
		t.Fatal(err)
	}
	if reviews, _ = queries.GetAIReviews(repo, ctx, []string{"s1"}); reviews["s1"].Status != models.AIReviewDone {
		t.Errorf("switching off hid an existing review: %+v", reviews)
	}
}

type recordingProvider struct {
	answer        string
	prompt, judge *string
}

func (r recordingProvider) Judge(_ context.Context, req Request) (string, error) {
	*r.prompt, *r.judge = req.Prompt, req.Personality.Name
	return r.answer, nil
}
func (r recordingProvider) Model() string { return "recording" }

func TestEveryRunIsLogged(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'artist', 'u1@example.com'), ('admin', 'admin', 'a@example.com')`)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'u1', '2026-12-01')`)

	santa, _ := queries.GetAIPersonality(repo, ctx, "ai-santa")
	pickles, _ := queries.GetAIPersonality(repo, ctx, "ai-professor-pickles")
	pickles.SystemPrompt = "A tweaked, unsaved prompt."

	// A real review, then two judges side by side on a custom drawing
	answer := `{"criteria": [{"id": "ai-santa-nice-list", "score": 6}], "score": 1, "comment": "Ho ho ho!"}`
	if _, err := Review(ctx, repo, fakeProvider{answer: answer}, "s1", Request{Personality: santa, Prompt: "p"}, RunMeta{Kind: queries.AIRunSubmission, UserID: "u1"}); err != nil {
		t.Fatal(err)
	}
	results := RunTests(ctx, repo, fakeProvider{answer: `{"score": 7, "comment": "Pickle-tastic!"}`},
		[]models.AIPersonality{santa, pickles}, "a custom prompt", []byte("png"),
		RunMeta{BatchID: "batch1", UserID: "admin", ImageData: "data:image/png;base64,cG5n"})
	if len(results) != 2 || results[0].Name != "Santa" || results[1].Name != "Professor Pickles" {
		t.Fatalf("results = %+v; want Santa then Pickles", results)
	}
	if results[1].Verdict == nil || results[1].Verdict.Comment != "Pickle-tastic!" {
		t.Errorf("Pickles' result = %+v", results[1])
	}

	runs, err := queries.ListAIRuns(repo, ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(runs) != 3 {
		t.Fatalf("logged %d runs, want 3", len(runs))
	}
	kinds := map[queries.AIRunKind]int{}
	for _, run := range runs {
		kinds[run.Kind]++
		if run.Kind == queries.AIRunTest {
			if run.BatchID != "batch1" || run.SubmissionID != nil || run.ImageData == "" || run.User == nil || run.User.Username != "admin" {
				t.Errorf("test run = %+v", run)
			}
			if run.JudgeName == "Professor Pickles" && run.SystemPrompt != "A tweaked, unsaved prompt." {
				t.Errorf("the log should keep the prompt as it ran, got %q", run.SystemPrompt)
			}
		} else if run.ArtistID != "u1" || run.User == nil || run.User.Username != "artist" {
			t.Errorf("submission run = %+v", run)
		}
	}
	if kinds[queries.AIRunSubmission] != 1 || kinds[queries.AIRunTest] != 2 {
		t.Errorf("kinds = %v", kinds)
	}

	// Tests never touch the doodle's review
	reviews, _ := queries.GetAIReviews(repo, ctx, []string{"s1"})
	if reviews["s1"].Comment != "Ho ho ho!" {
		t.Errorf("a test run changed the real review: %+v", reviews["s1"])
	}

	stats, err := queries.GetAIRunStats(repo, ctx)
	if err != nil || stats.Total != 3 || stats.Submissions != 1 || stats.Tests != 2 || stats.Today != 3 {
		t.Errorf("stats = %+v, %v", stats, err)
	}
}

func TestRerunReplacesWhatThePlayerSeesButKeepsTheLog(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'u1', 'u1@example.com'), ('admin', 'admin', 'a@example.com')`)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'u1', '2026-12-01')`)
	p, err := queries.GetAIPersonality(repo, ctx, "ai-sir-doodleton")
	if err != nil {
		t.Fatal(err)
	}
	first := `{"criteria": [], "score": 3, "comment": "A tragedy in three blobs."}`
	if _, err := Review(ctx, repo, fakeProvider{answer: first}, "s1", Request{Personality: p}, RunMeta{Kind: queries.AIRunSubmission, UserID: "u1"}); err != nil {
		t.Fatal(err)
	}
	if err := queries.MarkAIReviewHeard(repo, ctx, "s1", "u1"); err != nil {
		t.Fatal(err)
	}

	second := `{"criteria": [], "score": 9, "comment": "On reflection, the blobs are genius."}`
	if _, err := Review(ctx, repo, fakeProvider{answer: second}, "s1", Request{Personality: p}, RunMeta{Kind: queries.AIRunRerun, UserID: "admin"}); err != nil {
		t.Fatal(err)
	}

	subs := []*models.UserPromptSubmission{{ID: "s1"}}
	if err := queries.AttachAIReviews(repo, ctx, subs); err != nil {
		t.Fatal(err)
	}
	if got := subs[0].AIReview; got == nil || got.Comment != "On reflection, the blobs are genius." {
		t.Fatalf("player sees %+v; want the re-run's comment", got)
	}
	activity, _ := queries.GetAIReviewActivity(repo, ctx, "u1", &config.Config{})
	if len(activity) != 1 || activity[0].AIReview.Heard {
		t.Errorf("a re-run should be new to the player again: %+v", activity)
	}

	runs, err := queries.ListAIRuns(repo, ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	comments := map[string]queries.AIRunKind{}
	for _, r := range runs {
		comments[r.Comment] = r.Kind
	}
	if comments["A tragedy in three blobs."] != queries.AIRunSubmission || comments["On reflection, the blobs are genius."] != queries.AIRunRerun {
		t.Errorf("the log should keep both runs: %+v", comments)
	}
}
