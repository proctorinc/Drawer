package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/dbtest"
	"errors"
	"testing"
	"time"
)

// Runs the real events migrations (including their seeds) against an in-memory SQLite DB.
func TestGetActiveEvent(t *testing.T) {
	repo := dbtest.NewEventsDB(t)

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
		if event.Slug != "christmas-2026" || event.Name != "Doodlemas" || event.Theme != "christmas" {
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
