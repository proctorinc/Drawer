package handlers

import (
	"drawer-service-backend/internal/ai"
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/dbtest"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
