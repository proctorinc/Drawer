package handlers

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"os"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestGetLevelUps(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1) // every connection to :memory: is a separate database
	defer db.Close()
	schema, err := os.ReadFile("../../migrations/schema.sql")
	if err != nil {
		t.Fatal(err)
	}
	// 40 XP from before the week, then a drawing yesterday reaches level 2 (50 XP). The
	// achievement after it (75 XP) is short of level 3 (150 XP).
	_, err = db.Exec(string(schema) + `
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x');
		INSERT INTO user_submissions (id, user_id, day, created_at) VALUES
			('d1', 'me', date('now', '-13 days'), datetime('now', '-13 days')),
			('d2', 'me', date('now', '-12 days'), datetime('now', '-12 days')),
			('d3', 'me', date('now', '-11 days'), datetime('now', '-11 days')),
			('d4', 'me', date('now', '-10 days'), datetime('now', '-10 days')),
			('d5', 'me', date('now', '-1 days'), datetime('now', '-1 days'));
		INSERT INTO achievements (id, image_url, name, description, achievement_field, achievement_value)
			VALUES ('first', '', 'First', 'Draw once', 'SUBMISSION_TOTAL', 1);
		INSERT INTO user_achievements (achievement_id, user_id, created_at) VALUES ('first', 'me', datetime('now', '-2 hours'));`)
	if err != nil {
		t.Fatal(err)
	}

	got, err := getLevelUps(db, context.Background(), models.User{ID: "me"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Level != 2 || got[0].ID != "level-2" || got[0].Date.IsZero() {
		t.Errorf("getLevelUps = %+v; want just level 2", got)
	}
}
