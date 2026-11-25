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
	"maps"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
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
	v, err := ParseEvaluation(`{"seen": " a cat ", "idea": " a cat napping ", "notable": " the tail ", "score": 14}`, critic(), Swing{})
	if err != nil {
		t.Fatal(err)
	}
	if v.Score != 10 {
		t.Errorf("score = %v, want clamped to 10", v.Score)
	}
	if v.Seen != "a cat" || v.Idea != "a cat napping" || v.Notable != "the tail" {
		t.Errorf("seen %q, idea %q, notable %q", v.Seen, v.Idea, v.Notable)
	}
	if comment, err := ParseComment(`{"comment": "  A  triumph.  "}`); err != nil || comment != "A triumph." {
		t.Errorf("comment = %q, %v", comment, err)
	}
	if len(v.Criteria) != 0 {
		t.Errorf("criteria = %v, want none", v.Criteria)
	}
}

func TestParseVerdictAveragesCriteria(t *testing.T) {
	// 8 and 10 (clamped from 12) average to 9, whatever overall score the model gave
	v, err := ParseEvaluation(`{"criteria": [{"id": "spirit", "score": 12}, {"id": "nice", "score": 8}], "score": 2, "comment": "Ho ho ho!"}`, santa(), Swing{})
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
	v, err := ParseEvaluation(`{"criteria": [{"id": "nice", "score": 0}], "score": 5, "comment": "Hmm."}`, santa(), Swing{})
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
	v, err := ParseEvaluation(`{"criteria": [{"id": "nice", "score": 8}, {"id": "spirit", "score": 7}, {"id": "craft", "score": 7}], "score": 1, "comment": "Hm."}`, three, Swing{})
	if err != nil {
		t.Fatal(err)
	}
	if v.Score != 7.3 {
		t.Errorf("score = %v, want 22 / 3 rounded to 7.3", v.Score)
	}
}

func TestParseVerdictRejectsBadAnswers(t *testing.T) {
	if _, err := ParseEvaluation(`not json`, critic(), Swing{}); err == nil {
		t.Error("ParseEvaluation should fail on bad JSON")
	}
	for _, raw := range []string{`not json`, `{"comment": "   "}`} {
		if _, err := ParseComment(raw); err == nil {
			t.Errorf("ParseComment(%q) should fail", raw)
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

func TestSystemPromptsSplitTheJobs(t *testing.T) {
	evaluate := EvaluateSystemPrompt(santa())
	if strings.Contains(evaluate, "You are Santa.") {
		t.Error("the evaluation shouldn't get the judge's character, which sways how it reads the drawing")
	}
	for _, want := range []string{`nice: "nice list". Effort.`, `spirit: "christmas spirit". Festive.`, "from 1 (dreadful) to 10", "what the artist was going for", "benefit of the doubt", "Ground every reading in something actually drawn", "not funny", "finer than the brush", "erasing back to the background", "plus a fixed background color", "Composition (for any score", "a backpack for going back to school", "\"improve\""} {
		if !strings.Contains(evaluate, want) {
			t.Errorf("evaluate prompt is missing %q:\n%s", want, evaluate)
		}
	}
	if strings.Contains(EvaluateSystemPrompt(critic()), "by id") {
		t.Error("a judge without criteria shouldn't be asked to score criteria")
	}

	comment := CommentSystemPrompt(santa())
	for _, want := range []string{"You are Santa.", "Stay fully in character", "Find one specific, concrete thing in this drawing", "Roast or tease the artist", "Play along with the artist's idea", "at most 30 words"} {
		if !strings.Contains(comment, want) {
			t.Errorf("comment prompt is missing %q:\n%s", want, comment)
		}
	}
	if strings.Contains(comment, "nice list") {
		t.Error("the comment call doesn't score, so it shouldn't get the criteria")
	}
}

func TestCommentMessageHandsOverTheEvaluation(t *testing.T) {
	v, err := ParseEvaluation(`{"seen": "a sleeping sloth, a ringing clock", "idea": "the clock says it overslept", "missing": "", "prompt": "nailed", "effort": "real", "criteria": [{"id": "nice", "score": 7}, {"id": "spirit", "score": 8}], "score": 1, "notable": "the clock's wobbly legs"}`, santa(), Swing{})
	if err != nil {
		t.Fatal(err)
	}
	got := CommentMessage("a sloth running late", v)
	for _, want := range []string{`"a sloth running late"`, "a ringing clock", "the clock says it overslept", "Missing from the prompt: nothing", "Score: 8 out of 10 (nice list 7.5, christmas spirit 8.5)", "the clock's wobbly legs"} {
		if !strings.Contains(got, want) {
			t.Errorf("comment message is missing %q:\n%s", want, got)
		}
	}
}

func TestResponseSchema(t *testing.T) {
	if got := CommentSchema()["required"]; strings.Join(got.([]string), ",") != "comment" {
		t.Errorf("comment required = %v", got)
	}
	schema := EvaluateSchema(critic())
	if got := schema["required"]; strings.Join(got.([]string), ",") != "seen,idea,missing,prompt,effort,improve,score,notable" {
		t.Errorf("required = %v", got)
	}
	schema = EvaluateSchema(santa())
	if got := schema["required"]; strings.Join(got.([]string), ",") != "seen,idea,missing,prompt,effort,criteria,improve,score,notable" {
		t.Errorf("required = %v", got)
	}

	// The properties go out in order, so the model looks before it scores
	raw, err := json.Marshal(schema)
	if err != nil {
		t.Fatal(err)
	}
	order := []string{`"seen"`, `"idea"`, `"missing"`, `"prompt"`, `"effort"`, `"criteria"`, `"score"`, `"notable"`}
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
		v, err := ParseEvaluation(`{"seen": " a cat ", "effort": "`+c.text+`", "criteria": [{"id": "nice", "score": 7}, {"id": "spirit", "score": 9}], "score": 1, "comment": "Hm."}`, santa(), Swing{})
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
	v, _ := ParseEvaluation(`{"effort": "none", "score": 1, "comment": "Blank."}`, critic(), Swing{})
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
		v, err := ParseEvaluation(`{"missing": " the hat ", "prompt": "`+c.prompt+`", "effort": "real", "criteria": [{"id": "nice", "score": 7.24}, {"id": "spirit", "score": 9}], "score": 1, "comment": "Hm."}`, santa(), Swing{})
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
	if v, _ := ParseEvaluation(`{"prompt": "partial", "score": 6.66, "comment": "Hm."}`, critic(), Swing{}); v.Score != 5.2 {
		t.Errorf("score = %v, want 6.7 - 1.5 = 5.2", v.Score)
	}
	if v, _ := ParseEvaluation(`{"prompt": "nailed", "score": 9.8, "comment": "Wow."}`, critic(), Swing{}); v.Score != 10 {
		t.Errorf("score = %v, want capped at 10", v.Score)
	}
	if v, _ := ParseEvaluation(`{"prompt": "missed", "score": 2, "comment": "Eh."}`, critic(), Swing{}); v.Score != 0 {
		t.Errorf("score = %v, want 2 - 3 floored at 0, never negative", v.Score)
	}
}

func TestParseVerdictSwing(t *testing.T) {
	// A loved doodle can reach the top; a hated one with a missed prompt bottoms out at 0
	v, _ := ParseEvaluation(`{"prompt": "complete", "criteria": [{"id": "nice", "score": 8.5}, {"id": "spirit", "score": 9.2}], "score": 1, "comment": "Wow."}`, santa(), Swing{Kind: SwingBoost, Points: 1.8})
	if v.Criteria[0].Score != 10 || v.Criteria[1].Score != 10 || v.Score != 10 || v.Swing.Points != 1.8 {
		t.Errorf("loved: criteria %+v, score %v, swing %v; want 10, 10 and 10", v.Criteria, v.Score, v.Swing)
	}
	v, _ = ParseEvaluation(`{"prompt": "missed", "criteria": [{"id": "nice", "score": 4}, {"id": "spirit", "score": 6}], "score": 1, "comment": "Ugh."}`, santa(), Swing{Kind: SwingBoost, Points: -2})
	if v.Criteria[0].Score != 0 || v.Criteria[1].Score != 1 || v.Score != 0.5 {
		t.Errorf("hated: criteria %v, %v and score %v; want 0, 1 and 0.5", v.Criteria[0].Score, v.Criteria[1].Score, v.Score)
	}
}

func TestOnlyTheCommentHearsAboutASwing(t *testing.T) {
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
		got := swingFeeling(c.swing)
		for _, feeling := range []string{"LOVE", "HATE", "OBSESSED", "WORST"} {
			if strings.Contains(got, feeling) != (feeling == c.want) {
				t.Errorf("swing %+v: %q", c.swing, got)
			}
			if strings.Contains(EvaluateMessage("a cat"), feeling) {
				t.Errorf("the evaluation shouldn't hear about the swing")
			}
		}
		if strings.Contains(strings.ToLower(got), "score") || strings.Contains(got, "point") {
			t.Errorf("the judge should only hear how it feels, not about the swing's points: %q", got)
		}
		if c.want != "" && !strings.Contains(CommentMessage("a cat", Verdict{Swing: c.swing}), c.want) {
			t.Errorf("swing %+v: the comment call wasn't told how it feels", c.swing)
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

	var asked []Call
	provider := fakeProvider{ask: func(call Call) (string, error) {
		asked = append(asked, call)
		if call.Step == StepEvaluate {
			return `{"seen": "a cat", "idea": "a cat, no hat", "prompt": "partial", "missing": "the hat", "effort": "real", "score": 8, "notable": "the whiskers"}`, nil
		}
		return `{"comment": "Hm."}`, nil
	}}
	verdict, _, err := RunAndLog(context.Background(), repo, provider, Request{Personality: critic(), Prompt: "a cat in a hat", Image: []byte("png")}, RunMeta{Kind: queries.AIRunTest})
	if err != nil {
		t.Fatal(err)
	}
	if len(asked) != 2 || asked[0].Step != StepEvaluate || asked[1].Step != StepComment {
		t.Fatalf("calls = %+v; want evaluate then comment", asked)
	}
	if strings.Contains(asked[0].User, "WORST") || !strings.Contains(asked[1].User, "WORST") {
		t.Errorf("only the comment should be told it hates it: %q / %q", asked[0].User, asked[1].User)
	}
	if !strings.Contains(asked[1].User, "Score: 3.1 out of 10") || !strings.Contains(asked[1].User, "the whiskers") {
		t.Errorf("the comment wasn't given the final score and notes:\n%s", asked[1].User)
	}
	if verdict.Score != 3.1 { // 8 - 1.5 for the prompt - 3.4 for the swing
		t.Errorf("score = %v, want 3.1", verdict.Score)
	}
	runs, err := queries.ListAIRuns(repo, context.Background(), 1)
	if err != nil || len(runs) != 1 {
		t.Fatalf("runs = %v, %v", runs, err)
	}
	got := runs[0].Metadata
	breakdown, calls := got.Breakdown, got.Calls
	got.Breakdown, got.SwingRoll, got.Calls = nil, nil, nil
	want := queries.AIRunMetadata{Seen: "a cat", Idea: "a cat, no hat", Notable: "the whiskers", Effort: "real", Prompt: "partial", PromptMissing: "the hat", PromptBonus: -1.5, Swing: "super", SwingPoints: -3.4}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("metadata = %+v, want %+v", got, want)
	}
	if breakdown == nil || breakdown.GivenScore != 8 || breakdown.BeforeEffort != 3.1 {
		t.Errorf("breakdown = %+v", breakdown)
	}
	// Every call, in full
	if len(calls) != 2 {
		t.Fatalf("logged calls = %+v", calls)
	}
	eval, comment := calls[0], calls[1]
	if eval.Step != StepEvaluate || eval.System != EvaluateSystemPrompt(critic()) || eval.Message != EvaluateMessage("a cat in a hat") ||
		!eval.Image || eval.Detail != DetailHigh || eval.Temperature == nil || *eval.Temperature != evaluateTemperature || !strings.Contains(string(eval.Schema), `"idea"`) || !strings.Contains(eval.Answer, `"the hat"`) || eval.Error != "" {
		t.Errorf("evaluate call = %+v", eval)
	}
	if comment.Step != StepComment || comment.System != CommentSystemPrompt(critic()) || !strings.Contains(comment.Message, "WORST") ||
		!comment.Image || comment.Detail != DetailLow || comment.Temperature != nil || comment.Answer != `{"comment": "Hm."}` {
		t.Errorf("comment call = %+v", comment)
	}
}

func TestAFailedCommentKeepsTheEvaluation(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	provider := fakeProvider{ask: func(call Call) (string, error) {
		if call.Step == StepEvaluate {
			return `{"seen": "a cat", "idea": "a cat", "prompt": "complete", "effort": "real", "score": 6, "notable": "ears"}`, nil
		}
		return `{"comment": ""}`, nil
	}}
	_, run, err := RunAndLog(context.Background(), repo, provider, Request{Personality: critic(), Prompt: "a cat"}, RunMeta{Kind: queries.AIRunTest})
	if err == nil || run.Status != "failed" {
		t.Fatalf("err %v, status %q; want a failed run", err, run.Status)
	}
	m := run.Metadata
	if m.Seen != "a cat" || m.Breakdown.GivenScore != 6 || len(m.Calls) != 2 || m.Calls[1].Error == "" || m.Calls[0].Error != "" {
		t.Errorf("metadata = %+v", m)
	}

	// A failed evaluation never asks for a comment
	asked := 0
	failing := fakeProvider{ask: func(Call) (string, error) { asked++; return "", errors.New("down") }}
	_, run, _ = RunAndLog(context.Background(), repo, failing, Request{Personality: critic()}, RunMeta{Kind: queries.AIRunTest})
	if asked != 1 || len(run.Metadata.Calls) != 1 || run.Metadata.Calls[0].Error != "down" {
		t.Errorf("asked %d times; calls = %+v", asked, run.Metadata.Calls)
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
	raw, err := client.Ask(context.Background(), Call{Step: StepEvaluate, System: "sys", User: EvaluateMessage("a banana"), Image: []byte("png"), Schema: EvaluateSchema(critic())})
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
	if got["temperature"] != nil {
		t.Errorf("temperature = %v, want the model's default when unset", got["temperature"])
	}
	if format["type"] != "json_schema" || format["json_schema"].(map[string]any)["name"] != "doodle_evaluate" {
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
	_, err := client.Ask(context.Background(), Call{Step: StepEvaluate, Schema: EvaluateSchema(critic())})
	if err == nil || !strings.Contains(err.Error(), "Incorrect API key") {
		t.Errorf("err = %v", err)
	}

	if _, err := NewOpenAI("", "").Ask(context.Background(), Call{}); err == nil {
		t.Error("judging without a key should fail")
	}
}

// fakeProvider gives the same answer to every call; one JSON object with both the
// evaluation's fields and the comment does for both.
type fakeProvider struct {
	answer string
	err    error
	ask    func(Call) (string, error) // Answers instead, when set
}

func (f fakeProvider) Ask(_ context.Context, call Call) (string, error) {
	if f.ask != nil {
		return f.ask(call)
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
	} else if !strings.Contains(p.Criteria[0].Description, "thick brush") || !strings.Contains(p.Criteria[2].Description, "background put to work") ||
		!strings.Contains(p.Criteria[1].Description, "clever readings") {
		t.Errorf("Sir Doodleton's skill and composition should be described for this medium: %+v", p.Criteria)
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
	if p, _ = queries.PickAIPersonality(repo, ctx, event.ID, "2026-12-04"); p.ID != "ai-santa" {
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
	answer := `{"criteria": [{"id": "ai-santa-good-deed", "score": 10}, {"id": "ai-santa-happy-ending", "score": 9}, {"id": "ai-santa-giving", "score": 7}], "score": 1, "comment": "That doesn't look like my reindeer!"}`
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
	if !strings.Contains(gotPrompt, `"a banana"`) || !strings.Contains(gotJudge, "Sir Doodleton") {
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

func (r recordingProvider) Ask(_ context.Context, call Call) (string, error) {
	if call.Step == StepEvaluate {
		*r.prompt = call.User
	} else {
		*r.judge = call.System
	}
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
	answer := `{"criteria": [{"id": "ai-santa-good-deed", "score": 6}], "score": 1, "comment": "Ho ho ho!"}`
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

func TestRerunChangesNothingUntilApplied(t *testing.T) {
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

	seen := func() string {
		t.Helper()
		subs := []*models.UserPromptSubmission{{ID: "s1"}}
		if err := queries.AttachAIReviews(repo, ctx, subs); err != nil {
			t.Fatal(err)
		}
		if subs[0].AIReview == nil {
			return ""
		}
		return subs[0].AIReview.Comment
	}
	runsByComment := func() map[string]queries.AIRun {
		t.Helper()
		runs, err := queries.ListAIRuns(repo, ctx, 10)
		if err != nil {
			t.Fatal(err)
		}
		byComment := map[string]queries.AIRun{}
		for _, r := range runs {
			byComment[r.Comment] = r
		}
		return byComment
	}

	if r := runsByComment()["A tragedy in three blobs."]; !r.Current || r.AppliedAt == nil {
		t.Errorf("a real doodle's run should be applied and current: %+v", r)
	}

	second := `{"criteria": [], "score": 9, "comment": "On reflection, the blobs are genius."}`
	_, rerun, err := RunAndLog(ctx, repo, fakeProvider{answer: second}, Request{Personality: p}, RunMeta{Kind: queries.AIRunRerun, SubmissionID: "s1", UserID: "admin"})
	if err != nil {
		t.Fatal(err)
	}
	if got := seen(); got != "A tragedy in three blobs." {
		t.Fatalf("before applying, player sees %q; want the first review", got)
	}
	if r := runsByComment()["On reflection, the blobs are genius."]; r.Kind != queries.AIRunRerun || r.Current || r.AppliedAt != nil {
		t.Errorf("an unapplied re-run should be logged but not applied: %+v", r)
	}

	if err := queries.ApplyAIRun(repo, ctx, rerun.ID); err != nil {
		t.Fatal(err)
	}
	if got := seen(); got != "On reflection, the blobs are genius." {
		t.Fatalf("after applying, player sees %q; want the re-run's comment", got)
	}
	activity, _ := queries.GetAIReviewActivity(repo, ctx, "u1", &config.Config{})
	if len(activity) != 1 || activity[0].AIReview.Heard {
		t.Errorf("an applied re-run should be new to the player again: %+v", activity)
	}
	runs := runsByComment()
	if r := runs["On reflection, the blobs are genius."]; !r.Current || r.AppliedAt == nil {
		t.Errorf("the applied re-run should be current: %+v", r)
	}
	if r := runs["A tragedy in three blobs."]; r.Current || r.AppliedAt == nil {
		t.Errorf("the first run should stay applied but no longer be current: %+v", r)
	}
}

func TestApplyTestRun(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'u1', 'u1@example.com'), ('admin', 'admin', 'a@example.com')`)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'u1', '2026-12-01')`)
	p, err := queries.GetAIPersonality(repo, ctx, "ai-sir-doodleton")
	if err != nil {
		t.Fatal(err)
	}
	answer := `{"criteria": [], "score": 6, "comment": "Tested and true."}`
	results := RunTests(ctx, repo, fakeProvider{answer: answer}, []models.AIPersonality{p}, "a cat", nil, RunMeta{SubmissionID: "s1", UserID: "admin"})
	custom := RunTests(ctx, repo, fakeProvider{answer: answer}, []models.AIPersonality{p}, "a cat", nil, RunMeta{UserID: "admin", ImageData: "data:image/png;base64,"})
	failed := RunTests(ctx, repo, fakeProvider{err: errors.New("boom")}, []models.AIPersonality{p}, "a cat", nil, RunMeta{SubmissionID: "s1", UserID: "admin"})
	unsaved := p
	unsaved.ID = ""
	gone := RunTests(ctx, repo, fakeProvider{answer: answer}, []models.AIPersonality{unsaved}, "a cat", nil, RunMeta{SubmissionID: "s1", UserID: "admin"})

	// A doodle that was never reviewed (judging was off) gets one
	if err := queries.ApplyAIRun(repo, ctx, results[0].Run.ID); err != nil {
		t.Fatal(err)
	}
	subs := []*models.UserPromptSubmission{{ID: "s1"}}
	if err := queries.AttachAIReviews(repo, ctx, subs); err != nil {
		t.Fatal(err)
	}
	if got := subs[0].AIReview; got == nil || got.Comment != "Tested and true." || got.Judge.ID != p.ID {
		t.Fatalf("player sees %+v; want the test run's review", got)
	}

	for name, c := range map[string]struct {
		id   string
		want error
	}{
		"custom drawing": {custom[0].Run.ID, queries.ErrAIRunNoDoodle},
		"failed run":     {failed[0].Run.ID, queries.ErrAIRunFailed},
		"unsaved judge":  {gone[0].Run.ID, queries.ErrAIRunJudgeGone},
		"no such run":    {"nope", sql.ErrNoRows},
	} {
		if err := queries.ApplyAIRun(repo, ctx, c.id); !errors.Is(err, c.want) {
			t.Errorf("%s: err = %v; want %v", name, err, c.want)
		}
	}
}

func TestVerdictKeepsItsBreakdown(t *testing.T) {
	answer := `{"prompt": "partial", "effort": "low", "criteria": [{"id": "nice", "score": 14}], "score": 3, "comment": "Hm."}`
	v, err := ParseEvaluation(answer, santa(), Swing{Kind: SwingBoost, Points: 1})
	if err != nil {
		t.Fatal(err)
	}
	b := v.Breakdown
	if b.GivenScore != 3 || b.FittedScore != 3 || len(b.Criteria) != 2 {
		t.Fatalf("breakdown = %+v", b)
	}
	// Each criterion: given, fitted to 1..10, then -1.5 for the prompt and +1 for the swing
	var nice, spirit models.AICriterionStep
	for _, c := range b.Criteria {
		if c.ID == "nice" {
			nice = c
		} else {
			spirit = c
		}
	}
	if nice.Given != 14 || nice.Fitted != 10 || nice.Score != 9.5 || nice.Skipped {
		t.Errorf("nice = %+v", nice)
	}
	if !spirit.Skipped || spirit.Fitted != 5 || spirit.Score != 4.5 {
		t.Errorf("spirit = %+v", spirit)
	}
	if b.BeforeEffort != 7 || v.Score != 5.3 { // 7, less a quarter for low effort
		t.Errorf("before effort %v, score %v", b.BeforeEffort, v.Score)
	}
}

func TestVerdictKeepsWhatWouldImproveIt(t *testing.T) {
	v, err := ParseEvaluation(`{"criteria": [{"id": "nice", "improve": " fill the hat ", "score": 6}, {"id": "spirit", "improve": "add snow", "score": 7}], "improve": "ignored", "score": 6}`, santa(), Swing{})
	if err != nil {
		t.Fatal(err)
	}
	if b := v.Breakdown; b.Criteria[0].Improve != "fill the hat" || b.Criteria[1].Improve != "add snow" {
		t.Errorf("criteria steps = %+v", b.Criteria)
	}
	v, _ = ParseEvaluation(`{"improve": " bigger cat ", "score": 6}`, critic(), Swing{})
	if v.Breakdown.Improve != "bigger cat" {
		t.Errorf("improve = %q", v.Breakdown.Improve)
	}
	// Players never see it: it isn't on the scores they're shown
	raw, _ := json.Marshal(v.Criteria)
	if strings.Contains(string(raw), "improve") {
		t.Errorf("criteria shown to players carry improvements: %s", raw)
	}
}

func TestJudgesMoveToGPT41(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	cfg := &config.Config{}
	if s, err := LoadSettings(repo, ctx, cfg); err != nil || s.Model != "gpt-4.1" {
		t.Fatalf("with no model saved, model = %q, %v; want gpt-4.1", s.Model, err)
	}
	// The admin screen saved the old default: the migration moves it along
	dbtest.Exec(t, repo, `INSERT INTO ai_settings (key, value) VALUES ('openai_model', 'gpt-4.1-mini')`)
	dbtest.ApplyMigration(t, repo, "1795132300_ai_model_gpt41.up.sql")
	if s, _ := LoadSettings(repo, ctx, cfg); s.Model != "gpt-4.1" {
		t.Errorf("saved gpt-4.1-mini became %q; want gpt-4.1", s.Model)
	}
	// Any other choice stays
	dbtest.Exec(t, repo, `UPDATE ai_settings SET value = 'gpt-4o' WHERE key = 'openai_model'`)
	dbtest.ApplyMigration(t, repo, "1795132300_ai_model_gpt41.up.sql")
	if s, _ := LoadSettings(repo, ctx, cfg); s.Model != "gpt-4o" {
		t.Errorf("a deliberate choice became %q; want gpt-4o", s.Model)
	}
}

func TestRollSwingKeepsTheDice(t *testing.T) {
	for range 2000 {
		s := realRollSwing()
		if s.Roll == nil || s.Roll.Roll < 0 || s.Roll.Roll >= 1 || len(s.Roll.Tiers) != len(SwingTiers) {
			t.Fatalf("roll = %+v", s.Roll)
		}
		if s.Kind != SwingNone && s.Roll.Hates != (s.Points < 0) {
			t.Fatalf("hates %v but %v points", s.Roll.Hates, s.Points)
		}
	}
}

func TestTheGrinchJudgesChristmasSundays(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	event, err := queries.GetEventBySlug(repo, ctx, "christmas-2026")
	if err != nil {
		t.Fatal(err)
	}
	for _, day := range []string{"2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20", "2026-12-24"} {
		p, err := queries.PickAIPersonality(repo, ctx, event.ID, day)
		if err != nil || p.ID != "ai-grinch" || !p.ScoresBackwards || len(p.Criteria) != 3 {
			t.Errorf("%s: judge = %s (backwards %v, %d criteria), %v; want the Grinch, backwards, with 3", day, p.ID, p.ScoresBackwards, len(p.Criteria), err)
		}
	}
	for _, day := range []string{"2026-11-27", "2026-12-01", "2026-12-25"} {
		if p, _ := queries.PickAIPersonality(repo, ctx, event.ID, day); p.ID != "ai-santa" {
			t.Errorf("%s: judge = %s; want Santa", day, p.ID)
		}
	}
	// His criteria are what he wants, and each tells players to go against him
	g, _ := queries.GetAIPersonality(repo, ctx, "ai-grinch")
	names := []string{}
	for _, c := range g.Criteria {
		names = append(names, c.Name)
		if !strings.Contains(c.Description, "him") {
			t.Errorf("%s should dare players to go against him: %s", c.Name, c.Description)
		}
	}
	if strings.Join(names, ", ") != "humbug, cave art, spoiled" {
		t.Errorf("the Grinch's criteria = %v", names)
	}
	// Players never hear outright that he scores backwards
	for _, giveaway := range []string{"backwards", "upside", "0", "zero", "low score"} {
		if strings.Contains(strings.ToLower(g.Bio), giveaway) {
			t.Errorf("the Grinch's bio gives it away (%q): %s", giveaway, g.Bio)
		}
	}
}

func TestDoodlemasSplitsSantasDaysWithTheUnionElves(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	event, err := queries.GetEventBySlug(repo, ctx, "christmas-2026")
	if err != nil {
		t.Fatal(err)
	}

	judged := map[string]int{}
	for day := time.Date(2026, 11, 27, 0, 0, 0, 0, time.UTC); day.Day() != 26; day = day.AddDate(0, 0, 1) {
		p, err := queries.PickAIPersonality(repo, ctx, event.ID, day.Format(time.DateOnly))
		if err != nil {
			t.Fatal(err)
		}
		judged[p.ID]++
	}
	if want := map[string]int{"ai-santa": 16, "ai-union-elves": 8, "ai-grinch": 5}; !maps.Equal(judged, want) {
		t.Errorf("Doodlemas days judged = %v; want two of Santa's for each of the elves', and the Grinch's five", judged)
	}

	elves, err := queries.GetAIPersonality(repo, ctx, "ai-union-elves")
	if err != nil || !elves.Enabled || elves.ScoresBackwards || elves.EventID != nil || len(elves.Criteria) != 3 {
		t.Fatalf("the Union Elves = %+v, %v; want an enabled, forwards judge of their own days, with 3 criteria", elves, err)
	}
	if !strings.Contains(elves.SystemPrompt, "Your comment is") {
		t.Errorf("the Union Elves have no comment style:\n%s", elves.SystemPrompt)
	}
	// Their days' prompts give them a job to see done
	if prompt, _ := queries.GetDailyPrompt(repo, ctx, "2026-12-09"); prompt.Prompt != "the elf who has to fix santa's sleigh" {
		t.Errorf("Dec 9 = %q; want the elves' version", prompt.Prompt)
	}

	santa, _ := queries.GetAIPersonality(repo, ctx, "ai-santa")
	names := []string{}
	for _, c := range santa.Criteria {
		names = append(names, c.Name)
	}
	if strings.Join(names, ", ") != "good deed, happy ending, gift of giving" {
		t.Errorf("Santa's criteria = %v", names)
	}
}

func TestDoodlemasPromptsKeepAnAdminsEdit(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.ApplyMigration(t, repo, "1795132820_doodlemas_judge_prompts.down.sql")
	dbtest.Exec(t, repo, `UPDATE daily_prompts SET prompt = 'an admin prompt' WHERE day = '2026-12-06'`)
	dbtest.ApplyMigration(t, repo, "1795132820_doodlemas_judge_prompts.up.sql")

	for day, want := range map[string]string{"2026-12-06": "an admin prompt", "2026-12-03": "an elf on strike", "2026-12-24": "a sleigh piled high with presents"} {
		if prompt, _ := queries.GetDailyPrompt(repo, ctx, day); prompt.Prompt != want {
			t.Errorf("%s = %q; want %q", day, prompt.Prompt, want)
		}
	}
}

func grinch() models.AIPersonality {
	return models.AIPersonality{
		ID: "grinch", Name: "The Grinch", SystemPrompt: "You are the Grinch.", ScoresBackwards: true,
		Criteria: []models.AICriterion{
			{ID: "humbug", Name: "humbug", Description: "How gloomy it is."},
			{ID: "mess", Name: "mess", Description: "How sloppy it is."},
		},
	}
}

func TestABackwardsJudgeIsAskedForFaults(t *testing.T) {
	system := EvaluateSystemPrompt(grinch())
	for _, want := range []string{"from 0 (none of it at all)", "- humbug:", "A blank or unrelated image scores high", "most decent doodles land between 2 and 5"} {
		if !strings.Contains(system, want) {
			t.Errorf("a backwards judge's evaluation should say %q:\n%s", want, system)
		}
	}
	if strings.Contains(system, "masterpiece") || strings.Contains(system, "between 6 and 8") {
		t.Errorf("a backwards judge shouldn't get the usual 1-to-10 scale:\n%s", system)
	}
	if strings.Contains(EvaluateSystemPrompt(santa()), "faults") {
		t.Errorf("other judges score as usual")
	}
}

func TestABackwardsJudgeScoresFaultsAsGiven(t *testing.T) {
	// Scores aren't flipped, and missing the prompt adds nothing: it's a fault he rates himself
	v, err := ParseEvaluation(`{"prompt": "missed", "criteria": [{"id": "humbug", "score": 7}, {"id": "mess", "score": 8.5}], "score": 1}`, grinch(), Swing{})
	if err != nil {
		t.Fatal(err)
	}
	if !v.Backwards || v.PromptBonus != 0 || v.Criteria[0].Score != 7 || v.Criteria[1].Score != 8.5 || v.Score != 7.8 {
		t.Errorf("faults: criteria %+v, score %v, prompt bonus %v; want 7, 8.5 and 7.8 with no bonus", v.Criteria, v.Score, v.PromptBonus)
	}

	// A flawless doodle can get a real 0; other judges never go under 1 on their own
	v, _ = ParseEvaluation(`{"prompt": "nailed", "criteria": [{"id": "humbug", "score": 0}, {"id": "mess", "score": -1}], "score": 0}`, grinch(), Swing{})
	if v.Score != 0 || v.Criteria[0].Score != 0 || v.Criteria[1].Score != 0 {
		t.Errorf("flawless: criteria %+v, score %v; want all 0", v.Criteria, v.Score)
	}
	if v, _ = ParseEvaluation(`{"prompt": "complete", "criteria": [{"id": "nice", "score": 0}, {"id": "spirit", "score": 0}], "score": 0}`, santa(), Swing{}); v.Score != 1 {
		t.Errorf("Santa's lowest = %v; want 1", v.Score)
	}

	// A hated doodle can be pushed to 0 too
	v, _ = ParseEvaluation(`{"criteria": [{"id": "humbug", "score": 1}, {"id": "mess", "score": 1.5}], "score": 1}`, grinch(), Swing{Kind: SwingBoost, Points: -2})
	if v.Score != 0 {
		t.Errorf("hated: score %v; want 0", v.Score)
	}

	// A lazy, off-prompt scribble is what he loves: no effort penalty, it keeps his top marks
	v, _ = ParseEvaluation(`{"effort": "none", "prompt": "missed", "criteria": [{"id": "humbug", "score": 9.5}, {"id": "mess", "score": 10}], "score": 10}`, grinch(), Swing{})
	if v.Score != 9.8 || v.EffortPenalty != 0 {
		t.Errorf("blank canvas: score %v, effort penalty %v; want 9.8 and none", v.Score, v.EffortPenalty)
	}
	// He takes it as joining his plot to ruin Doodlemas, and praises them for it
	if msg := CommentMessage("a cat", v); !strings.Contains(msg, "praising them for joining your plot") {
		t.Errorf("a lazy doodle's comment message should have him welcome an accomplice: %s", msg)
	}
	// A good doodle defied him; a middling one leaves him unsure
	if msg := CommentMessage("a cat", Verdict{Backwards: true, Score: 1.5}); !strings.Contains(msg, "DEFIED you") || strings.Contains(msg, "praising") {
		t.Errorf("a good doodle should get roasted for defying him: %s", msg)
	}
	if msg := CommentMessage("a cat", Verdict{Backwards: true, Score: 5}); !strings.Contains(msg, "went halfway") {
		t.Errorf("a middling doodle should leave him unsure: %s", msg)
	}

	msg := CommentMessage("a cat", Verdict{Backwards: true, Swing: Swing{Kind: SwingSuper, Points: 3.5}})
	if !strings.Contains(msg, "OBSESSED") || !strings.Contains(msg, "count faults") {
		t.Errorf("comment message for a loved doodle, backwards: %s", msg)
	}
	if strings.Contains(CommentMessage("a cat", Verdict{}), "faults") {
		t.Errorf("only a backwards judge hears about it")
	}
}

func TestAGrinchZeroIsARealZero(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'u1', 'u1@example.com')`)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'u1', '2026-11-29')`)

	g, err := queries.GetAIPersonality(repo, ctx, "ai-grinch")
	if err != nil {
		t.Fatal(err)
	}
	answer := `{"prompt": "nailed", "criteria": [{"id": "ai-grinch-humbug", "score": 0}, {"id": "ai-grinch-cave-art", "score": 0}, {"id": "ai-grinch-spoiled", "score": 0}], "score": 0, "comment": "Bah."}`
	if _, err := Review(ctx, repo, fakeProvider{answer: answer}, "s1", Request{Personality: g}, RunMeta{Kind: queries.AIRunRerun, UserID: "u1"}); err != nil {
		t.Fatal(err)
	}
	subs := []*models.UserPromptSubmission{{ID: "s1"}}
	if err := queries.AttachAIReviews(repo, ctx, subs); err != nil {
		t.Fatal(err)
	}
	if r := subs[0].AIReview; r == nil || *r.Score != 0 {
		t.Fatalf("the Grinch's review = %+v; want a 0", r)
	}
	// It counts as a 0 everywhere (no perfect ten), and as the secret achievement's goal
	if best, _ := queries.CalculateAIBestScore(repo, ctx, "u1"); best != 0 {
		t.Errorf("best judge score = %d; want 0", best)
	}
	if zeros, err := queries.CalculateGrinchZeroCount(repo, ctx, "u1"); err != nil || zeros != 1 {
		t.Errorf("Grinch zeros = %d, %v; want 1", zeros, err)
	}
	var hidden bool
	if err := repo.QueryRow(`SELECT hidden FROM achievements WHERE id = 'grinch-zero' AND achievement_field = 'GRINCH_ZERO_TOTAL'`).Scan(&hidden); err != nil || !hidden {
		t.Errorf("the Grinch achievement should be secret: hidden %v, %v", hidden, err)
	}
}

func TestGrinchScoresEarnByFury(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'u1', 'u1@example.com')`)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('lazy', 'u1', '2026-11-29'), ('nice', 'u1', '2026-11-30')`)
	// A lazy scribble the Grinch loved, and a decent doodle Santa liked
	dbtest.Exec(t, repo, `INSERT INTO ai_reviews (submission_id, personality_id, status, score) VALUES
		('lazy', 'ai-grinch', 'done', 10), ('nice', 'ai-santa', 'done', 6.5)`)

	if best, _ := queries.CalculateAIBestScore(repo, ctx, "u1"); best != 6 {
		t.Errorf("best judge score = %d; want Santa's 6, not the Grinch's 10", best)
	}
	if great, _ := queries.CalculateAIGreatCount(repo, ctx, "u1"); great != 0 {
		t.Errorf("great doodles = %d; want none", great)
	}
	if reviewed, _ := queries.CalculateAIReviewCount(repo, ctx, "u1"); reviewed != 2 {
		t.Errorf("reviews = %d; his still counts as a review", reviewed)
	}
	events, err := queries.GetXPEventsSince(repo, ctx, "u1", time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range events {
		if e.Kind == "judge100" {
			t.Errorf("the Grinch's 10 earned a judge bonus: %+v", e)
		}
	}
	// A lazy 10 makes him an accomplice, once
	if side, _ := queries.CalculateGrinchSideCount(repo, ctx, "u1"); side != 1 {
		t.Errorf("accomplice doodles = %d; want 1", side)
	}

	// Making him furious is what pays: his 1 is worth a 9 in XP
	dbtest.Exec(t, repo, `UPDATE ai_reviews SET score = 1 WHERE submission_id = 'lazy'`)
	events, err = queries.GetXPEventsSince(repo, ctx, "u1", time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	kinds := []string{}
	for _, e := range events {
		if strings.HasPrefix(e.Kind, "judge") {
			kinds = append(kinds, e.Kind)
		}
	}
	if !slices.Contains(kinds, "judge90") {
		t.Errorf("judge XP events = %v; want the Grinch's 1 worth a 9 (judge90)", kinds)
	}
	if best, _ := queries.CalculateAIBestScore(repo, ctx, "u1"); best != 6 {
		t.Errorf("best judge score = %d; his scores still don't count toward score achievements", best)
	}

	// His 0 doesn't count as a low score either: it has its own achievement
	dbtest.Exec(t, repo, `UPDATE ai_reviews SET score = 0 WHERE submission_id = 'lazy'`)
	if low, _ := queries.CalculateAILowCount(repo, ctx, "u1"); low != 0 {
		t.Errorf("low scores = %d; want none", low)
	}
}

func TestTheGrinchMixesUpHisAngles(t *testing.T) {
	defer func(old func(int) int) { pickAngle = old }(pickAngle)
	seen := map[string]bool{}
	for i := range defierAngles {
		pickAngle = func(int) int { return i }
		seen[backwardsMood(1)] = true
	}
	if len(seen) != len(defierAngles) || len(defierAngles) < 5 {
		t.Errorf("got %d different defier moods from %d angles; want them all, and plenty", len(seen), len(defierAngles))
	}
	for _, pool := range [][]string{accompliceAngles, defierAngles, undecidedAngles} {
		if len(pool) < 3 {
			t.Errorf("an angle pool is too small for variety: %v", pool)
		}
	}
}

func TestTheGrinchStealsDoodlemasInHisIntro(t *testing.T) {
	system := IntroSystemPrompt(grinch(), "a penguin", "2026-12-06")
	for _, want := range []string{"STOLEN today's Doodlemas", "draw it BADLY", `"a penguin"`, `"traitor"`, `"secretFan"`} {
		if !strings.Contains(system, want) {
			t.Errorf("the Grinch's intro rules should say %q:\n%s", want, system)
		}
	}
	if strings.Contains(IntroSystemPrompt(santa(), "a penguin", "2026-12-06"), "STOLEN") {
		t.Errorf("only the Grinch steals the day")
	}

	// The model writes the opening once, and an ask per history
	answer := `{"lines": ["Doodlemas is mine!", "Draw me a penguin, badly."], "asks": {
		"first": "Will you join me?", "loyal": "Stay loyal?", "traitor": "Come back, traitor?",
		"rebel": "Switch sides?", "secretFan": "Admit it?"}, "replies": {
		"first": {"yes": "first yes", "no": "first no"}, "loyal": {"yes": "loyal yes", "no": "loyal no"},
		"traitor": {"yes": "traitor yes", "no": "traitor no"}, "rebel": {"yes": "rebel yes", "no": "rebel no"},
		"secretFan": {"yes": "secretFan yes", "no": "secretFan no"}}}`
	kept, err := ParseIntroFor(answer, grinch(), "A penguin")
	if err != nil || len(kept) != 17 {
		t.Fatalf("kept intro = %v, %v; want 2 lines, 5 asks and 10 replies", kept, err)
	}
	for history, want := range map[IntroHistory]string{
		HistoryFirst: "Will you join me?", HistoryLoyal: "Stay loyal?", HistoryTraitor: "Come back, traitor?",
		HistoryRebel: "Switch sides?", HistorySecretFan: "Admit it?",
	} {
		lines, replies := StolenIntro(kept, history)
		if len(lines) != 3 || lines[0] != "Doodlemas is mine!" || lines[2] != want {
			t.Errorf("%s hears %v; want the opening and %q", history, lines, want)
		}
		// and his reply to their answer fits who they are
		if replies == nil || replies.Yes != string(history)+" yes" || replies.No != string(history)+" no" {
			t.Errorf("%s gets replies %+v", history, replies)
		}
	}
	// Every ask has to ask
	if _, err := ParseIntroFor(strings.Replace(answer, "Switch sides?", "Switch sides.", 1), grinch(), "A penguin"); err == nil {
		t.Error("an ask that doesn't ask should be refused")
	}
	if _, err := ParseIntroFor(strings.Replace(answer, `"rebel": "Switch sides?",`, "", 1), grinch(), "A penguin"); err == nil {
		t.Error("a missing ask should be refused")
	}
	if _, err := ParseIntroFor(strings.Replace(answer, `"no": "rebel no"`, `"no": ""`, 1), grinch(), "A penguin"); err == nil {
		t.Error("a missing reply should be refused")
	}

	// The stock intro is kept the same way, and reads well for every history
	stock := StockIntroFor(grinch(), "A penguin", "2026-12-06")
	for _, h := range introAsks {
		lines, replies := StolenIntro(stock, h)
		if len(lines) != 3 || !strings.Contains(lines[2], "?") || !strings.Contains(lines[0], "stole") || replies == nil || replies.Yes == "" || replies.No == "" {
			t.Errorf("stock intro for %s = %v, %+v", h, lines, replies)
		}
	}
}

func TestTheGrinchRemembersYourLastVisit(t *testing.T) {
	yes, no := true, false
	bad, good := 8.0, 1.0
	cases := []struct {
		joined *bool
		score  *float64
		want   IntroHistory
	}{
		{nil, nil, HistoryFirst},
		{&yes, &bad, HistoryLoyal},
		{&yes, nil, HistoryLoyal},
		{&yes, &good, HistoryTraitor},
		{&no, &good, HistoryRebel},
		{&no, nil, HistoryRebel},
		{&no, &bad, HistorySecretFan},
	}
	for _, c := range cases {
		if got := HistoryFor(c.joined, c.score); got != c.want {
			t.Errorf("HistoryFor(%v, %v) = %s; want %s", c.joined, c.score, got, c.want)
		}
	}

	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'u1', 'u1@example.com'), ('new', 'new', 'new@example.com')`)
	// Week one: joined, then drew it well. Week two: refused, didn't draw.
	dbtest.Exec(t, repo, `INSERT INTO judge_pledges (user_id, day, personality_id, joined) VALUES
		('u1', '2026-11-29', 'ai-grinch', 1), ('u1', '2026-12-06', 'ai-grinch', 0)`)
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('w1', 'u1', '2026-11-29')`)
	dbtest.Exec(t, repo, `INSERT INTO ai_reviews (submission_id, personality_id, status, score) VALUES ('w1', 'ai-grinch', 'done', 1.5)`)

	history := func(user, day string) IntroHistory {
		joined, score, err := queries.GetLastJudgePledge(repo, ctx, user, day)
		if err != nil {
			t.Fatal(err)
		}
		return HistoryFor(joined, score)
	}
	if h := history("u1", "2026-12-06"); h != HistoryTraitor {
		t.Errorf("week two remembers %s; want traitor (joined, then drew well)", h)
	}
	if h := history("u1", "2026-12-13"); h != HistoryRebel {
		t.Errorf("week three remembers %s; want rebel (refused last)", h)
	}
	// Someone's first Grinch day can be any of them
	if h := history("new", "2026-12-13"); h != HistoryFirst {
		t.Errorf("a newcomer in week three is remembered as %s; want first", h)
	}
	if h := history("u1", "2026-11-29"); h != HistoryFirst {
		t.Errorf("week one remembers %s; want first (only earlier days count)", h)
	}
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestPledgesAreSavedUntilYouDraw(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES ('u1', 'u1', 'u1@example.com')`)
	event, _ := queries.GetEventBySlug(repo, ctx, "christmas-2026")

	if got, err := queries.GetJudgePledge(repo, ctx, "u1", "2026-11-29"); err != nil || got != nil {
		t.Fatalf("pledge before answering = %v, %v; want none", got, err)
	}
	// They can change their mind before drawing
	for _, joined := range []bool{true, false, true} {
		if err := queries.SaveJudgePledge(repo, ctx, "u1", "2026-11-29", "ai-grinch", event.ID, joined); err != nil {
			t.Fatal(err)
		}
	}
	got, err := queries.GetJudgePledge(repo, ctx, "u1", "2026-11-29")
	if err != nil || got == nil || !*got {
		t.Fatalf("pledge = %v, %v; want joined", got, err)
	}
	// Kept with the event, so we can find who joined him during Doodlemas
	var joiners int
	if err := repo.QueryRow(`SELECT COUNT(*) FROM judge_pledges WHERE event_id = ? AND joined = 1`, event.ID).Scan(&joiners); err != nil || joiners != 1 {
		t.Errorf("joiners during the event = %d, %v; want 1", joiners, err)
	}

	// Once they've drawn, it's locked
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES ('s1', 'u1', '2026-11-29')`)
	if err := queries.SaveJudgePledge(repo, ctx, "u1", "2026-11-29", "ai-grinch", event.ID, false); !errors.Is(err, queries.ErrPledgeAfterDrawing) {
		t.Errorf("changing sides after drawing: err = %v; want ErrPledgeAfterDrawing", err)
	}

	// The review hears it
	g, _ := queries.GetAIPersonality(repo, ctx, "ai-grinch")
	if pledge, err := PledgeFor(repo, ctx, g, "u1", "2026-11-29"); err != nil || pledge == nil || !*pledge {
		t.Errorf("the Grinch's review hears pledge %v, %v; want joined", pledge, err)
	}
	santa, _ := queries.GetAIPersonality(repo, ctx, "ai-santa")
	if pledge, _ := PledgeFor(repo, ctx, santa, "u1", "2026-11-29"); pledge != nil {
		t.Errorf("Santa shouldn't hear about pledges: %v", *pledge)
	}
}

func TestTheGrinchCallsOutBrokenPromises(t *testing.T) {
	yes, no := true, false
	cases := []struct {
		pledge *bool
		score  float64
		want   string
	}{
		{&yes, 9, "kept their word"},
		{&yes, 1, "TRAITOR"},
		{&yes, 5, "Hold them to their promise"},
		{&no, 1, "Call out their defiance"},
		{&no, 9, "secret accomplice"},
		{&no, 5, "couldn't commit"},
	}
	for _, c := range cases {
		msg := CommentMessage("a cat", Verdict{Backwards: true, Score: c.score, Pledge: c.pledge})
		if !strings.Contains(msg, c.want) {
			t.Errorf("pledged %v, scored %v: want %q in\n%s", *c.pledge, c.score, c.want, msg)
		}
	}
	if msg := CommentMessage("a cat", Verdict{Backwards: true, Score: 1}); strings.Contains(msg, "Before drawing") {
		t.Errorf("no answer, no twist: %s", msg)
	}

	// Run hands the pledge on to the comment call
	var commentMsg string
	provider := fakeProvider{ask: func(call Call) (string, error) {
		if call.Step == StepComment {
			commentMsg = call.User
			return `{"comment": "Traitor!"}`, nil
		}
		return `{"criteria": [{"id": "humbug", "score": 0}, {"id": "mess", "score": 0}], "score": 0}`, nil
	}}
	if _, err := Run(context.Background(), provider, Request{Personality: grinch(), Prompt: "a cat", Pledge: &yes}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(commentMsg, "TRAITOR") {
		t.Errorf("the comment call didn't hear about the broken promise:\n%s", commentMsg)
	}
}

func TestTheGrinchMakesABigDealOfChristmasEve(t *testing.T) {
	eve := IntroSystemPrompt(grinch(), "a penguin", "2026-12-24")
	if !strings.Contains(eve, "Christmas Eve") || !strings.Contains(eve, "last, best chance") {
		t.Errorf("his Christmas Eve intro rules should make a big deal of it:\n%s", eve)
	}
	if strings.Contains(IntroSystemPrompt(grinch(), "a penguin", "2026-12-20"), "Christmas Eve") {
		t.Error("only Christmas Eve is Christmas Eve")
	}
	// It's a fresh intro, not the one written for an ordinary day
	if introSourceHash(grinch(), "a penguin", "2026-12-24") == introSourceHash(grinch(), "a penguin", "2026-12-20") {
		t.Error("Christmas Eve should get its own intro")
	}
	lines, _ := StolenIntro(StockIntroFor(grinch(), "A penguin", "2026-12-24"), HistoryFirst)
	if !strings.Contains(lines[0], "Christmas Eve") {
		t.Errorf("his stock Christmas Eve opening = %q", lines[0])
	}

	// His reviews that day hear it too
	msg := CommentMessage("a cat", Verdict{Backwards: true, Score: 1, Day: "2026-12-24"})
	if !strings.Contains(msg, "Christmas Eve") || !strings.Contains(msg, "last chance") {
		t.Errorf("his Christmas Eve review should mention it:\n%s", msg)
	}
	if strings.Contains(CommentMessage("a cat", Verdict{Backwards: true, Score: 1, Day: "2026-12-20"}), "Christmas Eve") {
		t.Error("only Christmas Eve reviews mention it")
	}
	var commentMsg string
	provider := fakeProvider{ask: func(call Call) (string, error) {
		if call.Step == StepComment {
			commentMsg = call.User
			return `{"comment": "Bah."}`, nil
		}
		return `{"criteria": [{"id": "humbug", "score": 0}, {"id": "mess", "score": 0}], "score": 0}`, nil
	}}
	if _, err := Run(context.Background(), provider, Request{Personality: grinch(), Prompt: "a cat", Day: "2026-12-24"}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(commentMsg, "Christmas Eve") {
		t.Errorf("Run should pass the day on to the comment call:\n%s", commentMsg)
	}
}

func TestParseRepliesAtsEachPersonOnce(t *testing.T) {
	raw := `{"replies": [
		{"to": "@Bob", "comment": "a goalie does not melt."},
		{"to": "bob", "comment": "A second word for Bob."},
		{"to": "ann", "comment": "ann, lovely soup."},
		{"to": "stranger", "comment": "Who?"},
		{"to": "cat", "comment": "` + strings.Repeat("meow ", 60) + `"}
	]}`
	got, err := ParseReplies(raw, []string{"ann", "bob", "cat"})
	if err != nil {
		t.Fatal(err)
	}
	want := []ReplyDraft{
		{To: "bob", Text: "@bob a goalie does not melt."},
		{To: "ann", Text: "@ann lovely soup."},
	}
	if len(got) != 3 || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("drafts = %+v", got)
	}
	if !strings.HasPrefix(got[2].Text, "@cat meow") || !strings.HasSuffix(got[2].Text, "…") || utf8.RuneCountInString(got[2].Text) > maxReplyChars+6 {
		t.Errorf("rambling draft = %q", got[2].Text)
	}

	if _, err := ParseReplies(`{"replies": [{"to": "stranger", "comment": "hi"}]}`, []string{"ann"}); err == nil {
		t.Error("replies to nobody in the thread should fail")
	}
}

func TestReplyMessageWithoutComments(t *testing.T) {
	msg := ReplyMessage(ReplyRequest{Prompt: "A pear", Artist: "ann", Review: models.AIReview{Comment: "Pear-shaped."}})
	for _, want := range []string{"(nobody has commented yet)", `Your review: "Pear-shaped."`, "if nobody did, reply to ann."} {
		if !strings.Contains(msg, want) {
			t.Errorf("message lacks %q:\n%s", want, msg)
		}
	}
}
