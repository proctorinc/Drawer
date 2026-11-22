package handlers

import (
	"drawer-service-backend/internal/db/dbtest"
	"net/http"
	"testing"
)

func TestDeleteCommentOnlyByAuthor(t *testing.T) {
	router, repo := newEventsRouter(t, "2026-11-21")
	router.POST("/submission/:id/comment/:reactionId/reaction", HandleCommentToggleReaction)
	router.DELETE("/submission/:id/comment/:commentId", HandleDeleteComment)

	submit(t, repo, "s1", "friend", "2026-11-21")
	dbtest.Exec(t, repo, `INSERT INTO comments (id, submission_id, user_id, text) VALUES (1, 's1', 'me', 'mine'), (2, 's1', 'friend', 'theirs')`)
	dbtest.Exec(t, repo, `INSERT INTO reactions (user_id, content_type, content_id, reaction_id) VALUES ('friend', 'comment', '1', 'heart'), ('me', 'comment', '2', 'heart')`)

	if code, _ := request(t, router, "DELETE", "/submission/s1/comment/2", nil); code != http.StatusForbidden {
		t.Errorf("deleting a friend's comment = %d, want 403", code)
	}
	if code, _ := request(t, router, "DELETE", "/submission/other/comment/1", nil); code != http.StatusNotFound {
		t.Errorf("deleting under the wrong submission = %d, want 404", code)
	}
	if code, _ := request(t, router, "DELETE", "/submission/s1/comment/1", nil); code != http.StatusOK {
		t.Errorf("deleting my comment = %d, want 200", code)
	}
	if code, _ := request(t, router, "DELETE", "/submission/s1/comment/1", nil); code != http.StatusNotFound {
		t.Errorf("deleting it again = %d, want 404", code)
	}

	count := func(query string) (n int) {
		if err := repo.QueryRow(query).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if n := count(`SELECT COUNT(*) FROM comments`); n != 1 {
		t.Errorf("%d comments left, want only the friend's", n)
	}
	if n := count(`SELECT COUNT(*) FROM reactions WHERE content_type = 'comment' AND content_id = '1'`); n != 0 {
		t.Errorf("%d reactions left on the deleted comment", n)
	}
	if n := count(`SELECT COUNT(*) FROM reactions WHERE content_type = 'comment' AND content_id = '2'`); n != 1 {
		t.Errorf("reaction on the friend's comment was touched")
	}
}
