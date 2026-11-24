package handlers

import (
	"database/sql"
	"net/http"
	"testing"

	"drawer-service-backend/internal/db/dbtest"
)

func TestCreatePromptSavesWithAndWithoutAuthor(t *testing.T) {
	router, repo := newEventsRouter(t, "")
	router.POST("/admin/prompt", HandleCreatePrompt)
	// Production (Turso) enforces foreign keys, so an empty author id is rejected there
	dbtest.Exec(t, repo, `PRAGMA foreign_keys = ON`)
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2030-01-01', '["#000000"]', 'a cat')`)

	author := func() sql.NullString {
		var createdBy sql.NullString
		if err := repo.QueryRow(`SELECT created_by FROM daily_prompts WHERE day = '2030-01-01'`).Scan(&createdBy); err != nil {
			t.Fatal(err)
		}
		return createdBy
	}
	save := func(body map[string]any) {
		t.Helper()
		if code, resp := request(t, router, http.MethodPost, "/admin/prompt", body); code != http.StatusOK {
			t.Fatalf("saving %v: %d %v", body, code, resp)
		}
	}

	save(map[string]any{"day": "2030-01-01", "prompt": "a dog", "colors": []string{"#111111"}})
	if author().Valid {
		t.Errorf("an edit with no author left created_by = %q, want NULL", author().String)
	}

	save(map[string]any{"day": "2030-01-01", "prompt": "a dog", "colors": []string{"#111111"}, "createdBy": "friend"})
	if got := author(); got.String != "friend" {
		t.Errorf("created_by = %q, want friend", got.String)
	}

	save(map[string]any{"day": "2030-01-02", "prompt": "a bird", "colors": []string{"#222222"}, "createdBy": "friend"})
	var newAuthor string
	if err := repo.QueryRow(`SELECT created_by FROM daily_prompts WHERE day = '2030-01-02'`).Scan(&newAuthor); err != nil || newAuthor != "friend" {
		t.Errorf("a new prompt's created_by = %q (%v), want friend", newAuthor, err)
	}
}
