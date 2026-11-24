package handlers

import (
	"bytes"
	"context"
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

const testPNG = "data:image/png;base64,iVBORw0KGgo="

// A whole duel through the API: each request is made as whoever's named in X-As.
func TestDuelThroughTheAPI(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email, role) VALUES
		('amy', 'amy', 'a@x', 'admin'), ('bo', 'bo', 'b@x', 'user'), ('cy', 'cy', 'c@x', 'user')`)
	cfg := &config.Config{Env: "development"}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		id := c.GetHeader("X-As")
		role := "user"
		if id == "amy" {
			role = "admin"
		}
		c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		c.Set(middleware.UserContextKey, models.User{ID: id, Username: id, Role: role})
	})
	beta := router.Group("/beta", middleware.BetaRequired(repo))
	beta.GET("/duels", HandleListDuels)
	beta.POST("/duels", HandleCreateDuel)
	beta.GET("/duels/:id", HandleGetDuel)
	beta.POST("/duels/:id/start", HandleStartDuelDrawing)
	beta.POST("/duels/:id/drawing", HandleSubmitDuelDrawing)
	beta.POST("/duels/:id/guess", HandleDuelGuess)
	beta.POST("/duels/:id/nudge", HandleNudgeDuel)

	as := func(who, method, path string, body any) (int, map[string]any) {
		t.Helper()
		return requestAs(t, router, who, method, path, body)
	}

	if code, _ := as("bo", "GET", "/beta/duels", nil); code != http.StatusForbidden {
		t.Fatalf("bo before being let in: %d, want 403", code)
	}
	queries.AddBetaTester(repo, context.Background(), "bo", "amy")
	if code, _ := as("amy", "POST", "/beta/duels", map[string]string{"opponentId": "cy"}); code != http.StatusForbidden {
		t.Errorf("challenging someone outside the beta: %d, want 403", code)
	}

	code, d := as("amy", "POST", "/beta/duels", map[string]string{"opponentId": "bo"})
	if code != http.StatusCreated {
		t.Fatalf("create: %d %v", code, d)
	}
	id := d["id"].(string)
	path := "/beta/duels/" + id
	if code, body := as("amy", "POST", "/beta/duels", map[string]string{"opponentId": "bo"}); code != http.StatusConflict || body["duelId"] != id {
		t.Errorf("a second duel with bo: %d %v, want 409 pointing at the first", code, body)
	}

	round := func(view map[string]any, n int) map[string]any {
		return view["rounds"].([]any)[n-1].(map[string]any)
	}
	if round(d, 1)["prompt"] != "" {
		t.Error("amy shouldn't see her prompt before starting")
	}
	if code, _ := as("amy", "POST", path+"/drawing", map[string]string{"image": testPNG}); code != http.StatusConflict {
		t.Errorf("drawing before starting the clock: %d, want 409", code)
	}
	if code, _ := as("bo", "POST", path+"/start", nil); code != http.StatusConflict {
		t.Errorf("bo starting amy's turn: %d, want 409", code)
	}

	_, d = as("amy", "POST", path+"/start", nil)
	prompt := round(d, 1)["prompt"].(string)
	if prompt == "" || round(d, 1)["drawDeadline"] == nil {
		t.Fatalf("after starting, amy should see her prompt and a deadline: %v", round(d, 1))
	}
	// bo checks in while amy draws: amy sees he's here
	_, bo := as("bo", "GET", path, nil)
	if round(bo, 1)["prompt"] != "" {
		t.Error("bo saw the prompt he's meant to guess")
	}
	if _, d = as("amy", "GET", path, nil); d["otherHereNow"] != true {
		t.Error("amy should see bo is here right now")
	}

	if code, d = as("amy", "POST", path+"/drawing", map[string]string{"image": testPNG}); code != http.StatusOK || d["phase"] != "guess" || d["turnUserId"] != "bo" {
		t.Fatalf("after drawing: %d phase %v turn %v", code, d["phase"], d["turnUserId"])
	}

	// Three guesses: the last closes the round, the exact prompt scores the bonus
	for i, guess := range []string{"something", "a thing", prompt} {
		code, d = as("bo", "POST", path+"/guess", map[string]string{"guess": guess})
		if code != http.StatusOK {
			t.Fatalf("guess %d: %d %v", i+1, code, d)
		}
	}
	r1 := round(d, 1)
	if r1["finished"] != true || r1["score"] != float64(100) {
		t.Errorf("round 1 after an exact guess: %v", r1)
	}
	if code, _ := as("bo", "POST", path+"/guess", map[string]string{"guess": "more"}); code != http.StatusConflict {
		t.Errorf("a fourth guess: %d, want 409", code)
	}
	if d["turnUserId"] != "bo" || d["phase"] != "draw" || d["round"] != float64(2) {
		t.Fatalf("round 2 should be bo's to draw: %v %v %v", d["round"], d["phase"], d["turnUserId"])
	}

	// amy waits on bo: she can nudge once
	if code, _ := as("amy", "POST", path+"/nudge", nil); code != http.StatusOK {
		t.Errorf("nudge: %d", code)
	}
	if code, _ := as("amy", "POST", path+"/nudge", nil); code != http.StatusConflict {
		t.Errorf("nudging again straight away: %d, want 409", code)
	}

	as("bo", "POST", path+"/start", nil)
	as("bo", "POST", path+"/drawing", map[string]string{"image": testPNG})
	// amy guesses round 2 blank by blank: she sees the sentence, not the keywords
	_, d = as("amy", "GET", path, nil)
	if tpl := round(d, 2)["template"].([]any); len(tpl) == 0 || round(d, 2)["prompt"] != "" {
		t.Fatalf("amy should get the blanks but not the prompt: %v", round(d, 2))
	}
	stored, _ := queries.GetDuel(repo, context.Background(), id)
	keywords := stored.Rounds[1].Keywords
	if code, _ := as("amy", "POST", path+"/guess", map[string]any{"answers": []string{}}); code != http.StatusBadRequest {
		t.Errorf("answers that don't match the blanks: %d, want 400", code)
	}
	answers := make([]string, len(keywords))
	answers[0] = keywords[0]
	for i := 1; i < len(answers); i++ {
		answers[i] = "zzz"
	}
	code, d = as("amy", "POST", path+"/guess", map[string]any{"answers": answers})
	first := round(d, 2)["guesses"].([]any)[0].(map[string]any)["feedback"].(map[string]any)["keywords"].([]any)
	if code != http.StatusOK || first[0].(map[string]any)["keyword"] != keywords[0] || first[1].(map[string]any)["keyword"] != "" {
		t.Fatalf("first blank guess: %d %v", code, first)
	}
	// The hit blank stays hit with nothing typed in it
	answers[0] = ""
	for i := 0; i < 2; i++ {
		code, d = as("amy", "POST", path+"/guess", map[string]any{"answers": answers})
	}
	last := round(d, 2)["guesses"].([]any)[2].(map[string]any)["feedback"].(map[string]any)["keywords"].([]any)
	if last[0].(map[string]any)["status"] != "hit" {
		t.Errorf("the first keyword should stay hit: %v", last[0])
	}
	if code != http.StatusOK || d["status"] != "done" || d["complete"] != true {
		t.Fatalf("after the last guess: %d %v %v", code, d["status"], d["complete"])
	}
	r2 := round(d, 2)
	s2 := int(r2["score"].(float64))
	if want := float64((100 + s2 + 1) / 2); r2["prompt"] == "" || d["combined"] != want {
		t.Errorf("recap: round 2 %v, combined %v, want %v", r2, d["combined"], want)
	}

	// The host writes the summary in the background
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if _, d = as("amy", "GET", path, nil); d["summary"] != "" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if d["summary"] == "" {
		t.Error("no summary after the duel ended")
	}
}

func requestAs(t *testing.T, router *gin.Engine, who, method, path string, body any) (int, map[string]any) {
	t.Helper()
	var encoded []byte
	if body != nil {
		encoded, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(encoded))
	req.Header.Set("X-As", who)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	var decoded map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("%s %s: invalid JSON %q", method, path, recorder.Body.String())
	}
	return recorder.Code, decoded
}
