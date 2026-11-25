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
// The AI judge tables are left out of the dump and come from their migrations as well.
var eventMigrations = []string{
	"1795032990_add_events.up.sql",
	"1795035100_add_event_features.up.sql",
	"1795035200_seed_christmas_prompts.up.sql",
	"1795040100_seed_christmas_decorations.up.sql",
	"1795120000_rename_christmas_event.up.sql",
	"1795130000_add_ai_judges.up.sql",
	"1795130100_seed_ai_judges.up.sql",
	"1795130200_rename_event_doodlemas.up.sql",
	"1795130300_doodleton_composition.up.sql",
	"1795130400_ai_review_heard.up.sql",
	"1795130500_judge_comment_styles.up.sql",
	// Its column changes are already in the schema dump
	"1795130710_seed_more_achievements.up.sql",
	// Its tables are already in the schema dump
	"1795130810_seed_announcements.up.sql",
	"1795131100_seed_achievement_decorations.up.sql",
	"1795131900_add_ai_run_metadata.up.sql",
	"1795132200_doodleton_craft_criteria.up.sql",
	"1795132300_ai_model_gpt41.up.sql",
	"1795132400_ai_run_applied.up.sql",
	// 1795132500_prompt_pencils: its column is already in the schema dump
	"1795132600_ai_scores_backwards.up.sql",
	"1795132610_seed_grinch.up.sql",
	// Left out of the dump by the filter above (it has an event_id column)
	"1795132620_judge_pledges.up.sql",
	// 1795132730_drawing_starts, 1795132740_redos: already in the schema dump
	"1795132750_ai_replies.up.sql",
	"1795132800_seed_union_elves.up.sql",
	"1795132810_santa_nice_list.up.sql",
	"1795132820_doodlemas_judge_prompts.up.sql",
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
	// Filter whole statements, not lines: the dump writes some tables across several lines.
	var baseSchema []string
	for _, stmt := range strings.Split(schema, ";") {
		// SQLite makes sqlite_sequence itself; a dump that lists it can't be replayed
		if strings.Contains(stmt, "sqlite_sequence") {
			continue
		}
		if !strings.Contains(stmt, " events ") && !strings.Contains(stmt, "idx_events_") && !strings.Contains(stmt, " event_") && !strings.Contains(stmt, " ai_") {
			baseSchema = append(baseSchema, stmt)
		}
	}
	exec(t, repo, "schema.sql (without event tables)", strings.Join(baseSchema, ";"))

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
