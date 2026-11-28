package handlers

import (
	"context"
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAdminPromptStickers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	cfg := &config.Config{Env: "development"}
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2030-01-02', '[]', 'a goose')`)

	send := func(method, path, body string) (int, string) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		})
		router.GET("/stickers", HandleAdminListStickers)
		router.PUT("/prompts/:day/sticker", HandleAdminSetPromptSticker)
		router.DELETE("/prompts/:day/sticker", HandleAdminRemovePromptSticker)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(method, path, strings.NewReader(body)))
		return recorder.Code, recorder.Body.String()
	}
	stickerOf := func() *models.Sticker {
		prompt, err := queries.GetDailyPrompt(repo, context.Background(), "2030-01-02")
		if err != nil {
			t.Fatal(err)
		}
		return prompt.Sticker
	}

	if s := stickerOf(); s != nil {
		t.Errorf("a new prompt has sticker %+v; want none", s)
	}
	if code, _ := send("PUT", "/prompts/2030-01-02/sticker", `{"kind": "bubble", "size": 40, "maxChars": 12}`); code != http.StatusOK {
		t.Errorf("adding a bubble: %d", code)
	}
	if s := stickerOf(); s == nil || *s != (models.Sticker{Kind: "bubble", Size: 40, MaxChars: 12}) {
		t.Errorf("after adding a bubble the prompt has %+v", s)
	}
	if code, _ := send("PUT", "/prompts/2030-01-02/sticker", `{"kind": "googly-eyes", "size": 25}`); code != http.StatusOK {
		t.Errorf("swapping for googly eyes: %d", code)
	}
	if s := stickerOf(); s == nil || *s != (models.Sticker{Kind: "googly-eyes", Size: 25}) {
		t.Errorf("after swapping the prompt has %+v", s)
	}
	if code, body := send("GET", "/stickers", ""); code != http.StatusOK ||
		body != `{"stickers":[{"day":"2030-01-02","kind":"googly-eyes","size":25}]}` {
		t.Errorf("list = %d %s", code, body)
	}

	for _, bad := range []string{
		`{"kind": "mustache", "size": 40}`,
		`{"kind": "bubble", "size": 5, "maxChars": 10}`,
		`{"kind": "bubble", "size": 95, "maxChars": 10}`,
		`{"kind": "bubble", "size": 40}`,
		`{"kind": "bubble", "size": 40, "maxChars": 33}`,
		`{"kind": "googly-eyes", "size": 25, "maxChars": 10}`,
	} {
		if code, _ := send("PUT", "/prompts/2030-01-02/sticker", bad); code != http.StatusBadRequest {
			t.Errorf("%s: %d; want 400", bad, code)
		}
	}
	if code, _ := send("PUT", "/prompts/2030-01-03/sticker", `{"kind": "bubble", "size": 40, "maxChars": 10}`); code != http.StatusNotFound {
		t.Errorf("a day with no prompt: %d; want 404", code)
	}

	if code, _ := send("DELETE", "/prompts/2030-01-02/sticker", ""); code != http.StatusNoContent {
		t.Errorf("removing: %d", code)
	}
	if s := stickerOf(); s != nil {
		t.Errorf("after removing the prompt has %+v", s)
	}
}
