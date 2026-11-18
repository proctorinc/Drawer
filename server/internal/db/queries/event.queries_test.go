package queries

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// Runs the real events migration (including its seed) against an in-memory SQLite DB.
func TestGetActiveEvent(t *testing.T) {
	repo, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close()

	migration, err := os.ReadFile("../../../migrations/1795032990_add_events.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Exec(string(migration)); err != nil {
		t.Fatalf("applying migration: %v", err)
	}

	tests := []struct {
		now        string
		wantActive bool
	}{
		{"2026-11-26T23:59:59Z", false},
		{"2026-11-27T00:00:00Z", true},
		{"2026-12-31T23:59:59Z", true},
		{"2027-01-01T00:00:00Z", false},
	}
	for _, tt := range tests {
		now, _ := time.Parse(time.RFC3339, tt.now)
		event, err := GetActiveEvent(repo, context.Background(), now)

		if !tt.wantActive {
			if !errors.Is(err, sql.ErrNoRows) {
				t.Errorf("%s: expected sql.ErrNoRows, got %+v, %v", tt.now, event, err)
			}
			continue
		}
		if err != nil {
			t.Fatalf("%s: %v", tt.now, err)
		}
		if event.Slug != "christmas-2026" || event.Name != "29 Doodles of Christmas" || event.Theme != "christmas" {
			t.Errorf("%s: unexpected event %+v", tt.now, event)
		}
		if !event.StartsAt.Equal(time.Date(2026, 11, 27, 0, 0, 0, 0, time.UTC)) ||
			!event.EndsAt.Equal(time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)) {
			t.Errorf("%s: unexpected window %v - %v", tt.now, event.StartsAt, event.EndsAt)
		}
		if event.CountdownDays == nil || *event.CountdownDays != 29 {
			t.Errorf("%s: CountdownDays = %v, want 29", tt.now, event.CountdownDays)
		}
	}
}
