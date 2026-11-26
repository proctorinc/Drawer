package queries

import (
	"context"
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestPokes(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(`
		CREATE TABLE friendships (user1 TEXT, user2 TEXT, state TEXT);
		CREATE TABLE pokes (poker_id TEXT, pokee_id TEXT, day TEXT, PRIMARY KEY (poker_id, pokee_id, day));
		INSERT INTO friendships VALUES ('ann', 'bob', 'accepted'), ('ann', 'cat', 'pending');`)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	for _, tc := range []struct {
		a, b string
		want bool
	}{{"ann", "bob", true}, {"bob", "ann", true}, {"ann", "cat", false}} {
		got, err := AreFriends(db, ctx, tc.a, tc.b)
		if err != nil || got != tc.want {
			t.Errorf("AreFriends(%s, %s) = %v, %v; want %v", tc.a, tc.b, got, err, tc.want)
		}
	}

	for _, tc := range []struct {
		day  string
		want bool
	}{{"2026-11-18", true}, {"2026-11-18", false}, {"2026-11-19", true}} {
		got, err := RecordPoke(db, ctx, "ann", "bob", tc.day)
		if err != nil || got != tc.want {
			t.Errorf("RecordPoke on %s = %v, %v; want %v", tc.day, got, err, tc.want)
		}
	}
}

func TestPokesReadBack(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(`
		CREATE TABLE users (id TEXT, username TEXT, email TEXT, created_at TIMESTAMP, avatar_type TEXT, avatar_url TEXT, decoration TEXT NOT NULL DEFAULT '', color_hue INTEGER);
		CREATE TABLE pokes (poker_id TEXT, pokee_id TEXT, day TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
		INSERT INTO users VALUES ('ann', 'ann', 'a@x', '2026-01-01 00:00:00', 'default', '', '', NULL),
			('bob', 'bob', 'b@x', '2026-01-01 00:00:00', 'default', '', '', NULL);
		INSERT INTO pokes (poker_id, pokee_id, day) VALUES ('ann', 'bob', '2026-11-18'), ('bob', 'ann', '2026-11-18');
		INSERT INTO pokes VALUES ('ann', 'bob', '2026-11-01', datetime('now', '-17 days'));`)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	pokees, err := GetPokeesOn(db, ctx, "ann", "2026-11-18")
	if err != nil || len(pokees) != 1 || !pokees["bob"] {
		t.Errorf("GetPokeesOn = %v, %v; want only bob", pokees, err)
	}

	// The old poke is past the one-week window
	pokes, err := GetPokesReceived(db, ctx, "bob")
	if err != nil || len(pokes) != 1 {
		t.Fatalf("GetPokesReceived = %v, %v; want 1 poke", pokes, err)
	}
	if got := pokes[0]; got.User.ID != "ann" || got.Action != "poke" || got.ID != "poke-ann-2026-11-18" {
		t.Errorf("GetPokesReceived[0] = %+v", got)
	}
}
