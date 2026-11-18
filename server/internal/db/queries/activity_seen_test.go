package queries

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func TestActivitySeenAt(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE activity_reads (user_id TEXT PRIMARY KEY, last_read_activity_id TEXT, last_read_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	if got, err := GetActivitySeenAt(db, ctx, "ann"); err != nil || !got.IsZero() {
		t.Errorf("before any read: %v, %v; want zero time", got, err)
	}

	later := time.Date(2026, 11, 18, 21, 0, 0, 0, time.UTC)
	earlier := later.Add(-time.Hour)
	for _, seen := range []time.Time{later, earlier} {
		if err := SetActivitySeenAt(db, ctx, "ann", seen); err != nil {
			t.Fatal(err)
		}
	}
	// A stale device posting an older time doesn't move it back
	if got, err := GetActivitySeenAt(db, ctx, "ann"); err != nil || !got.Equal(later) {
		t.Errorf("after reads: %v, %v; want %v", got, err, later)
	}
}
