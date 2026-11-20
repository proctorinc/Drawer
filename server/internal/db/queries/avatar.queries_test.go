package queries

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestAvatarSlots(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1) // one connection, so the in-memory DB is shared

	_, err = db.Exec(`
		CREATE TABLE users (id TEXT PRIMARY KEY, avatar_type TEXT NOT NULL DEFAULT 'default', avatar_url TEXT NOT NULL DEFAULT '');
		INSERT INTO users (id, avatar_type, avatar_url) VALUES ('ann', 'custom', 'old-face'), ('bob', 'basic', '');`)
	if err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../../migrations/1795130600_add_user_avatars.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(string(migration)); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	worn := func(id string) (string, string) {
		var avatarType, url string
		if err := db.QueryRow(`SELECT avatar_type, avatar_url FROM users WHERE id = ?`, id).Scan(&avatarType, &url); err != nil {
			t.Fatal(err)
		}
		return avatarType, url
	}

	// The migration moves an existing drawing into slot 0, and skips those without one
	if got, _ := GetUserAvatars(db, ctx, "ann"); len(got) != 1 || got[0] != (UserAvatar{0, "old-face"}) {
		t.Fatalf("ann after migration = %v", got)
	}
	if got, _ := GetUserAvatars(db, ctx, "bob"); len(got) != 0 {
		t.Fatalf("bob after migration = %v", got)
	}

	// New faces fill slots and get worn
	for slot, url := range map[int]string{1: "face-b", 2: "face-c"} {
		if err := SaveUserAvatar(db, ctx, "ann", slot, url); err != nil {
			t.Fatal(err)
		}
	}
	if _, url := worn("ann"); url != "face-b" && url != "face-c" {
		t.Errorf("ann wears %q after saving", url)
	}

	// Redrawing a slot replaces it rather than adding a fourth
	if err := SaveUserAvatar(db, ctx, "ann", 1, "face-b2"); err != nil {
		t.Fatal(err)
	}
	got, _ := GetUserAvatars(db, ctx, "ann")
	want := []UserAvatar{{0, "old-face"}, {1, "face-b2"}, {2, "face-c"}}
	if len(got) != len(want) {
		t.Fatalf("ann's faces = %v; want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("ann's faces = %v; want %v", got, want)
		}
	}
	if _, url := worn("ann"); url != "face-b2" {
		t.Errorf("ann wears %q; want the redraw", url)
	}

	// Slots outside 0-2 are refused by the table itself
	if err := SaveUserAvatar(db, ctx, "ann", 3, "too-many"); err == nil {
		t.Error("saved a fourth slot")
	}

	// Switching faces, and from initials back to a face
	if _, err := db.Exec(`UPDATE users SET avatar_type = 'basic' WHERE id = 'ann'`); err != nil {
		t.Fatal(err)
	}
	if err := WearUserAvatar(db, ctx, "ann", 0); err != nil {
		t.Fatal(err)
	}
	if avatarType, url := worn("ann"); avatarType != "custom" || url != "old-face" {
		t.Errorf("ann wears %s %q; want custom old-face", avatarType, url)
	}

	// An empty slot can't be worn, and leaves the face alone
	if err := WearUserAvatar(db, ctx, "bob", 0); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("wearing an empty slot = %v; want sql.ErrNoRows", err)
	}
	if avatarType, url := worn("bob"); avatarType != "basic" || url != "" {
		t.Errorf("bob wears %s %q after a failed switch", avatarType, url)
	}
}
