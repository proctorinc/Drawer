package handlers

import (
	"context"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/queries"
	"net/http"
	"testing"
)

func TestUpdateDecoration(t *testing.T) {
	router, repo := newEventsRouter(t, "")
	router.PUT("/user/decoration", HandleUpdateDecoration)
	worn := func() string {
		user, err := queries.GetUserByID(repo, context.Background(), "me")
		if err != nil {
			t.Fatal(err)
		}
		return user.Decoration
	}

	for _, id := range []string{"PARTY_HAT", "CUSTOM_PROFILE_PIC"} {
		if code, _ := request(t, router, http.MethodPut, "/user/decoration", map[string]string{"decoration": id}); code != http.StatusBadRequest {
			t.Errorf("wearing %s: status %d, want 400", id, code)
		}
	}

	if code, _ := request(t, router, http.MethodPut, "/user/decoration", map[string]string{"decoration": "GOLDEN_SANTA_HAT"}); code != http.StatusForbidden {
		t.Errorf("wearing a locked decoration: status %d, want 403", code)
	}

	dbtest.Exec(t, repo, `INSERT INTO user_achievements (achievement_id, user_id) VALUES ('christmas-2026-doodle-claus', 'me')`)
	if code, body := request(t, router, http.MethodPut, "/user/decoration", map[string]string{"decoration": "GOLDEN_SANTA_HAT"}); code != http.StatusOK {
		t.Fatalf("wearing an unlocked decoration: status %d %v, want 200", code, body)
	}
	if got := worn(); got != "GOLDEN_SANTA_HAT" {
		t.Errorf("decoration = %q, want GOLDEN_SANTA_HAT", got)
	}

	if code, _ := request(t, router, http.MethodPut, "/user/decoration", map[string]string{"decoration": ""}); code != http.StatusOK {
		t.Errorf("taking it off: status %d, want 200", code)
	}
	if got := worn(); got != "" {
		t.Errorf("decoration after taking it off = %q, want none", got)
	}
}

// Everyone who sees a friend's avatar sees their decoration, so it rides along on every user the profile sends
func TestFriendsDecorationOnProfile(t *testing.T) {
	_, repo := newEventsRouter(t, "")
	ctx := context.Background()
	dbtest.Exec(t, repo, `UPDATE users SET decoration = 'CHRISTMAS_LIGHTS' WHERE id = 'friend'`)
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt, created_by) VALUES ('2026-10-01', '[]', 'a penguin', 'friend')`)
	submit(t, repo, "sub1", "friend", "2026-10-01")
	dbtest.Exec(t, repo, `INSERT INTO comments (submission_id, user_id, text) VALUES ('sub1', 'friend', 'nice')`)

	profile, err := queries.GetUserProfileFromDB(repo, ctx, "friend", "me", &config.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if profile.User.Decoration != "CHRISTMAS_LIGHTS" {
		t.Errorf("profile user decoration = %q", profile.User.Decoration)
	}
	if len(profile.Feed) != 1 || profile.Feed[0].User.Decoration != "CHRISTMAS_LIGHTS" ||
		len(profile.Feed[0].Comments) != 1 || profile.Feed[0].Comments[0].User.Decoration != "CHRISTMAS_LIGHTS" ||
		profile.Feed[0].CreatedBy == nil || profile.Feed[0].CreatedBy.Decoration != "CHRISTMAS_LIGHTS" {
		t.Errorf("feed is missing the friend's decoration: %+v", profile.Feed)
	}

	users, err := queries.GetUsersByIDs(repo, ctx, []string{"friend"})
	if err != nil || len(users) != 1 || users[0].Decoration != "CHRISTMAS_LIGHTS" {
		t.Errorf("GetUsersByIDs = %+v, %v", users, err)
	}
}
