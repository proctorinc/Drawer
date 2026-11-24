package duel

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"encoding/json"
	"errors"
	"strings"
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
			{"keyword": "shark", "status": "hit", "credit": 100, "note": "nailed it"},
			{"keyword": "bathtub", "status": "close", "relation": "similar", "credit": 60, "note": "think bath time"},
			{"keyword": "nonsense", "status": "hit", "credit": 100, "note": ""},
		},
		"note": "so close",
	})
	res, err := Score(context.Background(), fakeTalker{string(answer)}, GuessInput{
		Prompt: "a shark stuck in a bathtub", Keywords: []string{"shark", "stuck", "bathtub"}, Guess: "shark pool",
	})
	if err != nil {
		t.Fatal(err)
	}
	// (100 + 0 + 50) / 3: the close one is capped at 50
	if res.Score != 50 {
		t.Errorf("score = %d, want 50", res.Score)
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

// The AI's slips can't give the answer away: a close one with hit-sized credit stays
// close (and hidden), half a two-word keyword is only close, and hints only say where to
// look in the drawing.
func TestScoreKeepsMissedKeywordsSecret(t *testing.T) {
	answer, _ := json.Marshal(map[string]any{
		"words": []map[string]any{},
		"keywords": []map[string]any{
			{"keyword": "pirate ship", "status": "hit", "relation": "none", "credit": 95, "look": "none"},
			{"keyword": "sailing", "status": "hit", "relation": "none", "credit": 100, "look": "none"},
			{"keyword": "desert", "status": "close", "relation": "similar", "credit": 80, "look": "setting"},
		},
		"note": "So close to the desert!",
	})
	in := GuessInput{
		Prompt: "a pirate ship sailing through a desert", Keywords: []string{"pirate ship", "sailing", "desert"},
		Answers: []string{"ship", "sailing", "wasteland"},
	}
	in.Guess = FillTemplate(Template(in.Prompt, in.Keywords), in.Answers)
	res, err := Score(context.Background(), fakeTalker{string(answer)}, in)
	if err != nil {
		t.Fatal(err)
	}
	ship, sail, desert := res.Feedback.Keywords[0], res.Feedback.Keywords[1], res.Feedback.Keywords[2]
	if ship.Status != StatusClose || ship.Credit != partialCredit || ship.Relation != RelationBroader || ship.Answer != "ship" {
		t.Errorf("ship for pirate ship = %+v, want close and broader", ship)
	}
	if desert.Status != StatusClose || desert.Credit != closeMax || desert.Note != "look at the setting" {
		t.Errorf("desert = %+v, want close at %d, pointing at the setting", desert, closeMax)
	}
	if sail.Note != "" || strings.Contains(res.Note, "desert") {
		t.Errorf("notes: %q %q", sail.Note, res.Note)
	}
	hidden := res.Feedback.ForGuesser()
	if hidden.Keywords[0].Keyword != "" || hidden.Keywords[2].Keyword != "" || hidden.Keywords[1].Keyword != "sailing" {
		t.Errorf("ForGuesser = %+v", hidden.Keywords)
	}
	if in.Guess != "a ship sailing through a wasteland" {
		t.Errorf("guess = %q", in.Guess)
	}
}

// "pirate" for "pirate ship" stays yellow even when the AI calls it, and a round
// with a yellow left in it can't score like a solved one.
func TestHalfAnswerIsNeverAHit(t *testing.T) {
	answer, _ := json.Marshal(map[string]any{
		"words": []map[string]any{},
		"keywords": []map[string]any{
			{"keyword": "pirate ship", "status": "hit", "relation": "none", "credit": 100, "look": "none"},
			{"keyword": "sailing", "status": "hit", "relation": "none", "credit": 100, "look": "none"},
			{"keyword": "desert", "status": "hit", "relation": "none", "credit": 100, "look": "none"},
		},
		"note": "",
	})
	in := GuessInput{
		Prompt: "a pirate ship sailing through a desert", Keywords: []string{"pirate ship", "sailing", "desert"},
		Answers: []string{"pirate", "sailing", "desert"},
	}
	in.Guess = FillTemplate(Template(in.Prompt, in.Keywords), in.Answers)
	res, _ := Score(context.Background(), fakeTalker{string(answer)}, in)
	if pirate := res.Feedback.Keywords[0]; pirate.Status != StatusClose || pirate.Relation != RelationPart || pirate.Credit != partialCredit {
		t.Errorf("pirate = %+v, want close, part, %d", pirate, partialCredit)
	}
	if res.Score >= 100 || res.Exact {
		t.Errorf("score = %d exact = %v; a round with a part missing isn't solved", res.Score, res.Exact)
	}
}

func TestPartOf(t *testing.T) {
	for _, c := range []struct {
		answer, keyword, relation string
	}{
		{"ship", "pirate ship", RelationBroader},
		{"ships", "pirate ship", RelationBroader},
		{"pirate", "pirate ship", RelationPart},
		{"Pirate", "pirate ship", RelationPart},
		{"bear", "polar bear", RelationBroader},
		{"snow", "snowman", RelationPart},
		{"man", "snowman", RelationBroader},
		{"house", "lighthouse", RelationBroader},
		{"fish", "goldfish bowl", ""},
		{"pirate ship", "pirate ship", ""},
		{"boat", "pirate ship", ""},
		{"pirate boat", "pirate ship", ""},
		{"ice", "rice", ""},
		{"dog", "dog", ""},
		// Rough on purpose: scoring only uses it to pull a hit or close down
		{"cat", "category", RelationPart},
	} {
		relation, ok := partOf(c.answer, c.keyword)
		if ok != (c.relation != "") || relation != c.relation {
			t.Errorf("partOf(%q, %q) = %q, %v; want %q", c.answer, c.keyword, relation, ok, c.relation)
		}
	}
}

// A keyword hit once stays hit, and hitting the rest finishes the round.
func TestLockedKeywordsStayHit(t *testing.T) {
	in := GuessInput{
		Prompt: "a ghost doing laundry", Keywords: []string{"ghost", "laundry"},
		Answers: []string{"", "washing clothes"},
		Locked:  map[int]KeywordMark{0: {Keyword: "ghost", Status: StatusHit, Credit: 95, Answer: "spirit"}},
	}
	answer, _ := json.Marshal(map[string]any{
		"words": []map[string]any{},
		"keywords": []map[string]any{
			{"keyword": "ghost", "status": "miss", "relation": "none", "credit": 0, "look": "shape"},
			{"keyword": "laundry", "status": "hit", "relation": "none", "credit": 90, "look": "none"},
		},
		"note": "",
	})
	res, _ := Score(context.Background(), fakeTalker{string(answer)}, in)
	if g := res.Feedback.Keywords[0]; g.Status != StatusHit || g.Answer != "spirit" {
		t.Errorf("ghost = %+v, want it still hit", g)
	}
	if res.Score != 100 {
		t.Errorf("score = %d, want 100 with every part found", res.Score)
	}
}

func TestFallbackScoresBlankByBlank(t *testing.T) {
	res, _ := Score(context.Background(), nil, GuessInput{
		Prompt: "a robot walking a dog in the rain", Keywords: []string{"robot", "walking", "dog", "rain"},
		Answers: []string{"robot", "dog", "", ""}, Guess: "a robot dog a ___ in the ___",
	})
	if res.Feedback.Keywords[0].Status != StatusHit || res.Feedback.Keywords[2].Status != StatusMiss {
		t.Errorf("dog was in the wrong blank, so only robot counts: %+v", res.Feedback.Keywords)
	}
	if res.Feedback.Words == nil {
		t.Error("words should be an empty list, not null")
	}
}

func TestDuelFlow(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
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
