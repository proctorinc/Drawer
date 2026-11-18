package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func TestHideTodaysDrawings(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE user_submissions (id TEXT, user_id TEXT, day TEXT)`); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	today := utils.GetFormattedDate(time.Now())

	submissions := func() []*models.UserPromptSubmission {
		return []*models.UserPromptSubmission{
			{ID: "mine", Day: today, User: models.User{ID: "ann"}, ImageUrl: "mine.png"},
			{ID: "bobs-today", Day: today + "T00:00:00Z", User: models.User{ID: "bob"}, ImageUrl: "bob.png"},
			{ID: "bobs-past", Day: "2020-01-01", User: models.User{ID: "bob"}, ImageUrl: "old.png"},
		}
	}
	shown := func(subs []*models.UserPromptSubmission) []bool {
		return []bool{subs[0].ImageUrl != "", subs[1].ImageUrl != "", subs[2].ImageUrl != ""}
	}

	before := submissions()
	if err := HideTodaysDrawings(db, ctx, "ann", before); err != nil {
		t.Fatal(err)
	}
	if got := shown(before); got[0] != true || got[1] != false || got[2] != true {
		t.Errorf("before ann draws, shown = %v; want only bob's of today hidden", got)
	}

	if _, err := db.Exec(`INSERT INTO user_submissions VALUES ('mine', 'ann', ?)`, today); err != nil {
		t.Fatal(err)
	}
	after := submissions()
	if err := HideTodaysDrawings(db, ctx, "ann", after); err != nil {
		t.Fatal(err)
	}
	if got := shown(after); got[0] != true || got[1] != true || got[2] != true {
		t.Errorf("after ann draws, shown = %v; want all shown", got)
	}
}
