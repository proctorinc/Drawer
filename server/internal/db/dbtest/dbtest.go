// Package dbtest builds in-memory SQLite databases for tests.
package dbtest

import (
	"database/sql"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

// Migrations applied on top of the schema dump, so their seeds are tested too.
var eventMigrations = []string{
	"1795032990_add_events.up.sql",
	"1795035100_add_event_features.up.sql",
	"1795035200_seed_christmas_prompts.up.sql",
}

// NewEventsDB returns an in-memory database with the schema from migrations/schema.sql, where
// the event tables come from the real event migrations (including their seed data).
func NewEventsDB(t *testing.T) *sql.DB {
	t.Helper()

	repo, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	// Every connection to ":memory:" is a separate database, so keep just one.
	repo.SetMaxOpenConns(1)
	t.Cleanup(func() { repo.Close() })

	schema := readMigration(t, "schema.sql")
	var baseSchema []string
	for _, line := range strings.Split(schema, "\n") {
		if !strings.Contains(line, " events ") && !strings.Contains(line, "idx_events_") && !strings.Contains(line, " event_") {
			baseSchema = append(baseSchema, line)
		}
	}
	exec(t, repo, "schema.sql (without event tables)", strings.Join(baseSchema, "\n"))

	for _, name := range eventMigrations {
		ApplyMigration(t, repo, name)
	}
	return repo
}

// ApplyMigration runs a file from migrations/, failing the test on error.
func ApplyMigration(t *testing.T, repo *sql.DB, name string) {
	t.Helper()
	exec(t, repo, name, readMigration(t, name))
}

// Exec runs SQL, failing the test on error.
func Exec(t *testing.T, repo *sql.DB, query string, args ...any) {
	t.Helper()
	if _, err := repo.Exec(query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

func exec(t *testing.T, repo *sql.DB, name, query string) {
	t.Helper()
	if _, err := repo.Exec(query); err != nil {
		t.Fatalf("applying %s: %v", name, err)
	}
}

func readMigration(t *testing.T, name string) string {
	t.Helper()
	_, thisFile, _, _ := runtime.Caller(0)
	path := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "migrations", name)
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(contents)
}
