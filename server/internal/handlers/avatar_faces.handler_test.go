package handlers

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/queries"
	"net/http"
	"testing"
)

func TestAdminSetUserPicture(t *testing.T) {
	router, repo := newEventsRouter(t, "")
	router.PUT("/admin/users/:id/picture", HandleAdminSetUserPicture)
	router.GET("/avatar-faces", HandleGetAvatarFaces)
	ctx := context.Background()
	avatarType := func() string {
		user, err := queries.GetUserByID(repo, ctx, "friend")
		if err != nil {
			t.Fatal(err)
		}
		return user.AvatarType
	}
	faces := func() map[string]any {
		_, body := request(t, router, http.MethodGet, "/avatar-faces", nil)
		return body["faces"].(map[string]any)
	}

	dbtest.Exec(t, repo, `INSERT INTO user_avatars (user_id, slot, url) VALUES ('friend', 1, 'https://example.com/face.png')`)
	dbtest.Exec(t, repo, `UPDATE users SET avatar_type = 'custom' WHERE id = 'friend'`)

	if code, _ := request(t, router, http.MethodPut, "/admin/users/friend/picture", map[string]string{"face": "masc/crop/crew/none/beard"}); code != http.StatusOK {
		t.Fatalf("picking a sketch face: status %d, want 200", code)
	}
	if got := faces()["friend"]; got != "masc/crop/crew/none/beard" {
		t.Errorf("face = %v, want masc/crop/crew/none/beard", got)
	}
	if got := avatarType(); got != "basic" {
		t.Errorf("after a sketch face, avatar type = %q, want basic", got)
	}

	for _, bad := range []map[string]any{{"face": "masc/crop"}, {"face": "<script>/a/b/c/d"}} {
		if code, _ := request(t, router, http.MethodPut, "/admin/users/friend/picture", bad); code != http.StatusBadRequest {
			t.Errorf("%v: status %d, want 400", bad, code)
		}
	}
	if code, _ := request(t, router, http.MethodPut, "/admin/users/friend/picture", map[string]int{"slot": 2}); code != http.StatusNotFound {
		t.Errorf("an empty slot: status %d, want 404", code)
	}
	if code, _ := request(t, router, http.MethodPut, "/admin/users/nobody/picture", map[string]string{"face": ""}); code != http.StatusNotFound {
		t.Errorf("no such player: status %d, want 404", code)
	}

	if code, _ := request(t, router, http.MethodPut, "/admin/users/friend/picture", map[string]int{"slot": 1}); code != http.StatusOK {
		t.Fatalf("wearing a drawn face: status %d, want 200", code)
	}
	if got := avatarType(); got != "custom" {
		t.Errorf("after a drawn face, avatar type = %q, want custom", got)
	}

	if code, _ := request(t, router, http.MethodPut, "/admin/users/friend/picture", map[string]string{"face": "neutral/puff/crew/none/none"}); code != http.StatusOK {
		t.Fatalf("a sketch face again: status %d, want 200", code)
	}
	if code, _ := request(t, router, http.MethodPut, "/admin/users/friend/picture", map[string]bool{"drawn": true}); code != http.StatusOK {
		t.Fatalf("back to the drawn face they last wore: status %d, want 200", code)
	}
	if got := avatarType(); got != "custom" {
		t.Errorf("after their last drawn face, avatar type = %q, want custom", got)
	}
	if code, _ := request(t, router, http.MethodPut, "/admin/users/me/picture", map[string]bool{"drawn": true}); code != http.StatusNotFound {
		t.Errorf("someone who never drew a face: status %d, want 404", code)
	}

	if code, _ := request(t, router, http.MethodPut, "/admin/users/friend/picture", map[string]string{"face": ""}); code != http.StatusOK {
		t.Fatalf("going back to their own face: status %d, want 200", code)
	}
	if _, ok := faces()["friend"]; ok {
		t.Error("the picked face is still there after going back to their own")
	}
	if got := avatarType(); got != "basic" {
		t.Errorf("after their own face, avatar type = %q, want basic", got)
	}
}
