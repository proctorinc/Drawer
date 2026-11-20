package handlers

import (
	"context"
	"drawer-service-backend/internal/ai"
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/utils"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"time"

	"github.com/gin-gonic/gin"
)

func personalityInput(t *testing.T, raw string) PersonalityInput {
	t.Helper()
	var in PersonalityInput
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		t.Fatal(err)
	}
	return in
}

func TestPersonalityInputSlugsTheName(t *testing.T) {
	p, err := personalityInput(t, `{"name": "Sir Doodleton III!", "systemPrompt": "Pompous."}`).ToPersonality()
	if err != nil {
		t.Fatal(err)
	}
	if p.Slug != "sir-doodleton-iii" {
		t.Errorf("slug = %q", p.Slug)
	}
}

func TestPersonalityInputRejects(t *testing.T) {
	cases := map[string]string{
		"no name":         `{"systemPrompt": "x"}`,
		"no prompt":       `{"name": "x"}`,
		"four criteria":   `{"name": "x", "systemPrompt": "x", "criteria": [{"name":"a"},{"name":"b"},{"name":"c"},{"name":"d"}]}`,
		"unnamed":         `{"name": "x", "systemPrompt": "x", "criteria": [{"name":""}]}`,
		"default + event": `{"name": "x", "systemPrompt": "x", "isDefault": true, "eventId": "event1"}`,
	}
	for name, raw := range cases {
		if _, err := personalityInput(t, raw).ToPersonality(); err == nil {
			t.Errorf("%s: should be rejected", name)
		}
	}
}

func TestAdminAISettingsHidesTheKey(t *testing.T) {
	settings := newAdminAISettings(aiSettingsWithKey("sk-proj-abcdefgh1234"))
	out, _ := json.Marshal(settings)
	if strings.Contains(string(out), "abcdefgh") || settings.APIKeyHint != "…1234" || !settings.HasAPIKey {
		t.Errorf("settings = %s", out)
	}
}

func aiSettingsWithKey(key string) ai.Settings { return ai.Settings{APIKey: key, Model: "m"} }

func TestTodaysJudge(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)

	get := func(fakeNow string) (int, string) {
		cfg := &config.Config{Env: "development", EventsFakeNow: fakeNow}
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		})
		router.GET("/ai/judge/today", HandleGetTodaysJudge)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest("GET", "/ai/judge/today", nil))
		return recorder.Code, recorder.Body.String()
	}

	// Judging is off in the seed: nothing to show
	if code, _ := get("2026-06-01"); code != http.StatusNoContent {
		t.Fatalf("with judging off, status = %d; want 204", code)
	}

	dbtest.Exec(t, repo, `UPDATE ai_settings SET value = 'true' WHERE key = 'enabled'`)
	dbtest.Exec(t, repo, `INSERT INTO ai_settings (key, value) VALUES ('openai_api_key', 'sk-test')`)

	code, body := get("2026-06-01")
	if code != http.StatusOK || !strings.Contains(body, `"name":"Sir Doodleton"`) || !strings.Contains(body, `"recognizability"`) {
		t.Errorf("everyday judge = %d %s", code, body)
	}
	if strings.Contains(body, "systemPrompt") || strings.Contains(body, "harsh") {
		t.Errorf("players shouldn't see the personality prompt: %s", body)
	}
	if _, body = get("2026-12-05"); !strings.Contains(body, `"name":"Santa"`) {
		t.Errorf("during Doodlemas, judge = %s; want Santa", body)
	}
}

func TestTodaysJudgeIntro(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	cfg := &config.Config{Env: "development", EventsFakeNow: "2026-06-01"}

	get := func() (int, string) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		})
		router.GET("/ai/judge/today/intro", HandleGetTodaysJudgeIntro)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest("GET", "/ai/judge/today/intro", nil))
		return recorder.Code, recorder.Body.String()
	}

	// Judging is off in the seed: no intro
	if code, _ := get(); code != http.StatusNoContent {
		t.Fatalf("with judging off, status = %d; want 204", code)
	}

	dbtest.Exec(t, repo, `UPDATE ai_settings SET value = 'true' WHERE key = 'enabled'`)
	dbtest.Exec(t, repo, `INSERT INTO ai_settings (key, value) VALUES ('openai_api_key', 'sk-test')`)

	// No prompt today: nothing to ask for
	if code, _ := get(); code != http.StatusNoContent {
		t.Fatalf("with no prompt, status = %d; want 204", code)
	}

	today := utils.GetFormattedDate(time.Now())
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES (?, '[]', 'A prehistoric city')`, today)

	// The model can't be reached here, so the judge falls back to its stock lines
	old := ai.NewProvider
	t.Cleanup(func() { ai.NewProvider = old })
	ai.NewProvider = func(s ai.Settings) ai.Provider {
		client := ai.NewOpenAI("sk-test", "m")
		client.BaseURL = "http://127.0.0.1:1"
		return client
	}

	code, body := get()
	if code != http.StatusOK || !strings.Contains(body, `"name":"Sir Doodleton"`) ||
		!strings.Contains(body, "draw me a prehistoric city") || !strings.Contains(body, `"day":"`+today+`"`) {
		t.Errorf("intro = %d %s", code, body)
	}
	if strings.Contains(body, "systemPrompt") {
		t.Errorf("players shouldn't see the personality prompt: %s", body)
	}
}

func TestAdminSetPromptJudge(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	cfg := &config.Config{Env: "development"}
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2030-01-02', '[]', 'a goose')`)

	put := func(day, body string) int {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		})
		router.PUT("/prompts/:day/judge", HandleAdminSetPromptJudge)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest("PUT", "/prompts/"+day+"/judge", strings.NewReader(body)))
		return recorder.Code
	}
	judgeOf := func() string {
		prompts, err := queries.GetAllPrompts(repo, context.Background())
		if err != nil {
			t.Fatal(err)
		}
		for _, p := range prompts {
			if p.Day == "2030-01-02" {
				if p.JudgeID == nil {
					return "auto"
				}
				return *p.JudgeID
			}
		}
		t.Fatal("prompt missing")
		return ""
	}

	if code := put("2030-01-02", `{"judgeId": "ai-professor-pickles"}`); code != http.StatusOK || judgeOf() != "ai-professor-pickles" {
		t.Errorf("picking Professor Pickles: %d, judge %s", code, judgeOf())
	}
	if p, _ := ai.PickPersonalityForDay(repo, context.Background(), cfg, "2030-01-02"); p.ID != "ai-professor-pickles" {
		t.Errorf("that day's doodles go to %s", p.ID)
	}
	if code := put("2030-01-02", `{"judgeId": "ai-nobody"}`); code != http.StatusNotFound || judgeOf() != "ai-professor-pickles" {
		t.Errorf("an unknown judge: %d, judge %s", code, judgeOf())
	}
	if code := put("2030-01-03", `{"judgeId": "ai-santa"}`); code != http.StatusNotFound {
		t.Errorf("a day with no prompt: %d; want 404", code)
	}
	if code := put("2030-01-02", `{"judgeId": ""}`); code != http.StatusOK || judgeOf() != "auto" {
		t.Errorf("back to auto: %d, judge %s", code, judgeOf())
	}

	// Deleting a judge hands its days back to auto
	put("2030-01-02", `{"judgeId": "ai-professor-pickles"}`)
	if err := queries.DeleteAIPersonality(repo, context.Background(), "ai-professor-pickles"); err != nil {
		t.Fatal(err)
	}
	if judgeOf() != "auto" {
		t.Errorf("after deleting the judge, judge = %s; want auto", judgeOf())
	}
}

func TestTodaysJudgeIntro(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	cfg := &config.Config{Env: "development", EventsFakeNow: "2026-06-01"}

	get := func() (int, string) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		})
		router.GET("/ai/judge/today/intro", HandleGetTodaysJudgeIntro)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest("GET", "/ai/judge/today/intro", nil))
		return recorder.Code, recorder.Body.String()
	}

	// Judging is off in the seed: no intro
	if code, _ := get(); code != http.StatusNoContent {
		t.Fatalf("with judging off, status = %d; want 204", code)
	}

	dbtest.Exec(t, repo, `UPDATE ai_settings SET value = 'true' WHERE key = 'enabled'`)
	dbtest.Exec(t, repo, `INSERT INTO ai_settings (key, value) VALUES ('openai_api_key', 'sk-test')`)

	// No prompt today: nothing to ask for
	if code, _ := get(); code != http.StatusNoContent {
		t.Fatalf("with no prompt, status = %d; want 204", code)
	}

	today := utils.GetFormattedDate(time.Now())
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES (?, '[]', 'A prehistoric city')`, today)

	// The model can't be reached here, so the judge falls back to its stock lines
	old := ai.NewProvider
	t.Cleanup(func() { ai.NewProvider = old })
	ai.NewProvider = func(s ai.Settings) ai.Provider {
		client := ai.NewOpenAI("sk-test", "m")
		client.BaseURL = "http://127.0.0.1:1"
		return client
	}

	code, body := get()
	if code != http.StatusOK || !strings.Contains(body, `"name":"Sir Doodleton"`) ||
		!strings.Contains(body, "draw me a prehistoric city") || !strings.Contains(body, `"day":"`+today+`"`) {
		t.Errorf("intro = %d %s", code, body)
	}
	if strings.Contains(body, "systemPrompt") {
		t.Errorf("players shouldn't see the personality prompt: %s", body)
	}
}

func TestAdminSetPromptJudge(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	cfg := &config.Config{Env: "development"}
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2030-01-02', '[]', 'a goose')`)

	put := func(day, body string) int {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		})
		router.PUT("/prompts/:day/judge", HandleAdminSetPromptJudge)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest("PUT", "/prompts/"+day+"/judge", strings.NewReader(body)))
		return recorder.Code
	}
	judgeOf := func() string {
		prompts, err := queries.GetAllPrompts(repo, context.Background())
		if err != nil {
			t.Fatal(err)
		}
		for _, p := range prompts {
			if p.Day == "2030-01-02" {
				if p.JudgeID == nil {
					return "auto"
				}
				return *p.JudgeID
			}
		}
		t.Fatal("prompt missing")
		return ""
	}

	if code := put("2030-01-02", `{"judgeId": "ai-professor-pickles"}`); code != http.StatusOK || judgeOf() != "ai-professor-pickles" {
		t.Errorf("picking Professor Pickles: %d, judge %s", code, judgeOf())
	}
	if p, _ := ai.PickPersonalityForDay(repo, context.Background(), cfg, "2030-01-02"); p.ID != "ai-professor-pickles" {
		t.Errorf("that day's doodles go to %s", p.ID)
	}
	if code := put("2030-01-02", `{"judgeId": "ai-nobody"}`); code != http.StatusNotFound || judgeOf() != "ai-professor-pickles" {
		t.Errorf("an unknown judge: %d, judge %s", code, judgeOf())
	}
	if code := put("2030-01-03", `{"judgeId": "ai-santa"}`); code != http.StatusNotFound {
		t.Errorf("a day with no prompt: %d; want 404", code)
	}
	if code := put("2030-01-02", `{"judgeId": ""}`); code != http.StatusOK || judgeOf() != "auto" {
		t.Errorf("back to auto: %d, judge %s", code, judgeOf())
	}

	// Deleting a judge hands its days back to auto
	put("2030-01-02", `{"judgeId": "ai-professor-pickles"}`)
	if err := queries.DeleteAIPersonality(repo, context.Background(), "ai-professor-pickles"); err != nil {
		t.Fatal(err)
	}
	if judgeOf() != "auto" {
		t.Errorf("after deleting the judge, judge = %s; want auto", judgeOf())
	}
}
