package duel

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func TestIsExact(t *testing.T) {
	for guess, want := range map[string]bool{
		"a shark stuck in a bathtub":   true,
		"Sharks stuck in the bathtub!": true,
		"shark in a bathtub":           false,
		"":                             false,
	} {
		if got := IsExact(guess, "a shark stuck in a bathtub"); got != want {
			t.Errorf("IsExact(%q) = %v, want %v", guess, got, want)
		}
	}
}

func TestFallbackScore(t *testing.T) {
	res, err := Score(context.Background(), nil, GuessInput{
		Prompt: "a robot walking a dog in the rain", Keywords: []string{"robot", "walking", "dog", "rain"},
		Guess: "robots with dogs",
	})
	if err == nil {
		t.Error("want an error saying there was no AI")
	}
	if res.Score != 50 {
		t.Errorf("score = %d, want 50 (2 of 4 keywords)", res.Score)
	}
	if res.Feedback.Words[0].Status != StatusHit || res.Feedback.Words[1].Status != StatusMiss {
		t.Errorf("words = %+v", res.Feedback.Words)
	}
}

type fakeTalker struct{ answer string }

func (f fakeTalker) Talk(context.Context, string, string, string, map[string]any) (string, error) {
	return f.answer, nil
}

func TestScoreFromAI(t *testing.T) {
	answer, _ := json.Marshal(map[string]any{
		"words": []map[string]any{
			{"index": 0, "status": "hit", "note": "yep"},
			{"index": 1, "status": "close", "note": "nearly"},
			{"index": 9, "status": "hit", "note": "made up"},
		},
		"keywords": []map[string]any{
			{"keyword": "shark", "credit": 100, "note": "nailed it"},
			{"keyword": "bathtub", "credit": 60, "note": "think bath time"},
			{"keyword": "nonsense", "credit": 100, "note": ""},
		},
		"note": "so close",
	})
	res, err := Score(context.Background(), fakeTalker{string(answer)}, GuessInput{
		Prompt: "a shark stuck in a bathtub", Keywords: []string{"shark", "stuck", "bathtub"}, Guess: "shark pool",
	})
	if err != nil {
		t.Fatal(err)
	}
	// (100 + 0 + 60) / 3
	if res.Score != 53 {
		t.Errorf("score = %d, want 53", res.Score)
	}
	if got := res.Feedback.Keywords[2]; got.Status != StatusClose || got.Keyword != "bathtub" {
		t.Errorf("bathtub = %+v", got)
	}
	hidden := res.Feedback.ForGuesser()
	if hidden.Keywords[0].Keyword != "shark" || hidden.Keywords[1].Keyword != "" || hidden.Keywords[2].Keyword != "" {
		t.Errorf("ForGuesser leaked keywords: %+v", hidden.Keywords)
	}
	if len(res.Feedback.Words) != 2 {
		t.Errorf("words = %+v, want just the guess's 2", res.Feedback.Words)
	}
}

func TestDuelFlow(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	dbtest.ApplyMigration(t, repo, "1795131200_add_beta_duels.up.sql")
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email, role) VALUES ('a', 'amy', 'a@x', 'admin'), ('b', 'bo', 'b@x', 'user')`)
	ctx := context.Background()

	if ok, _ := queries.HasBetaAccess(repo, ctx, models.User{ID: "b"}); ok {
		t.Fatal("bo shouldn't have beta access yet")
	}
	if err := queries.AddBetaTester(repo, ctx, "b", "a"); err != nil {
		t.Fatal(err)
	}
	if ok, _ := queries.HasBetaAccess(repo, ctx, models.User{ID: "b"}); !ok {
		t.Fatal("bo should have beta access")
	}

	id, err := queries.CreateDuel(repo, ctx, "a", "b", "", [2]queries.NewDuelRound{
		{Prompt: "a ghost doing laundry", Keywords: []string{"ghost", "laundry"}},
		{Prompt: "a horse doing yoga", Keywords: []string{"horse", "yoga"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	load := func() models.Duel {
		d, err := queries.GetDuel(repo, ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		return d
	}

	d := load()
	if TurnUserID(d) != "a" {
		t.Fatalf("amy should draw first, turn = %q", TurnUserID(d))
	}
	if v := NewView(d, stockHost, "a", time.Now()); v.Rounds[0].Prompt != "" {
		t.Error("the drawer shouldn't see the prompt before starting their minute")
	}
	if _, err := CanGuess(d, "b"); !errors.Is(err, ErrNotYourTurn) {
		t.Errorf("bo guessing before the drawing: %v", err)
	}

	queries.StartDuelDrawing(repo, ctx, id, 1)
	d = load()
	if v := NewView(d, stockHost, "a", time.Now()); v.Rounds[0].Prompt != "a ghost doing laundry" {
		t.Error("the drawer should see the prompt once started")
	}
	if err := queries.SaveDuelDrawing(repo, ctx, id, 1, "data:image/png;base64,AA=="); err != nil {
		t.Fatal(err)
	}
	if err := queries.SaveDuelDrawing(repo, ctx, id, 1, "data:image/png;base64,AA=="); !errors.Is(err, queries.ErrAlreadyDone) {
		t.Errorf("second drawing: %v", err)
	}
	d = load()
	v := NewView(d, stockHost, "b", time.Now())
	if v.Phase != PhaseGuess || v.TurnUserID != "b" || v.Rounds[0].Prompt != "" || v.Rounds[0].KeywordCount != 2 || v.Rounds[0].Image == "" {
		t.Errorf("bo's view while guessing = %+v", v.Rounds[0])
	}

	fb, _ := json.Marshal(Feedback{Keywords: []KeywordMark{{Keyword: "ghost", Status: StatusHit, Credit: 100}, {Keyword: "laundry", Status: StatusMiss}}})
	for attempt, score := range []int{20, 50, 40} {
		last := attempt == 2
		if err := queries.AddDuelGuess(repo, ctx, id, 1, models.DuelGuess{Attempt: attempt + 1, Guess: "x", Score: score, Feedback: fb}, last, false); err != nil {
			t.Fatal(err)
		}
	}
	d = load()
	if s := d.Rounds[0].Score; s == nil || *s != 50 {
		t.Errorf("round 1 score = %v, want the best guess, 50", s)
	}
	if TurnUserID(d) != "b" {
		t.Errorf("bo should draw round 2, turn = %q", TurnUserID(d))
	}
	if v := NewView(d, stockHost, "b", time.Now()); v.Rounds[0].Prompt == "" || len(v.Rounds[0].Guesses[0].Feedback.Keywords) != 2 || v.Rounds[0].Guesses[0].Feedback.Keywords[1].Keyword != "laundry" {
		t.Error("a finished round should reveal the prompt and every keyword")
	}

	queries.StartDuelDrawing(repo, ctx, id, 2)
	queries.SaveDuelDrawing(repo, ctx, id, 2, "data:image/png;base64,AA==")
	if err := queries.AddDuelGuess(repo, ctx, id, 2, models.DuelGuess{Attempt: 1, Guess: "a horse doing yoga", Score: 100, Exact: true, Feedback: fb}, true, true); err != nil {
		t.Fatal(err)
	}
	d = load()
	if d.Status != models.DuelDone || TurnUserID(d) != "" {
		t.Errorf("duel should be done, status %q", d.Status)
	}
	if c, complete := Combined(d); c == nil || *c != 75 || !complete {
		t.Errorf("combined = %v, %v; want 75, complete", c, complete)
	}

	list, err := queries.ListDuels(repo, ctx, "b", 10)
	if err != nil || len(list) != 1 || list[0].Rounds[0].Image != "" || !list[0].Rounds[0].HasImage {
		t.Errorf("list = %+v, %v (drawings shouldn't load in lists)", list, err)
	}
}
