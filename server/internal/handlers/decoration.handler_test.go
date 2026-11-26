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
	if len(profile.Prompts) != 1 || profile.Prompts[0].User.Decoration != "CHRISTMAS_LIGHTS" ||
		len(profile.Prompts[0].Comments) != 1 || profile.Prompts[0].Comments[0].User.Decoration != "CHRISTMAS_LIGHTS" ||
		profile.Prompts[0].CreatedBy == nil || profile.Prompts[0].CreatedBy.Decoration != "CHRISTMAS_LIGHTS" {
		t.Errorf("friend's doodles are missing the friend's decoration: %+v", profile.Prompts)
	}

	users, err := queries.GetUsersByIDs(repo, ctx, []string{"friend"})
	if err != nil || len(users) != 1 || users[0].Decoration != "CHRISTMAS_LIGHTS" {
		t.Errorf("GetUsersByIDs = %+v, %v", users, err)
	}
}

func TestUpdateColor(t *testing.T) {
	router, repo := newEventsRouter(t, "")
	router.PUT("/user/color", HandleUpdateColor)
	picked := func() *int {
		user, err := queries.GetUserByID(repo, context.Background(), "me")
		if err != nil {
			t.Fatal(err)
		}
		return user.ColorHue
	}

	if got := picked(); got != nil {
		t.Fatalf("a new user's hue = %d, want none", *got)
	}

	for _, hue := range []any{360, -1, 12.5} {
		if code, _ := request(t, router, http.MethodPut, "/user/color", map[string]any{"colorHue": hue}); code != http.StatusBadRequest {
			t.Errorf("picking hue %v: status %d, want 400", hue, code)
		}
	}

	for _, hue := range []int{0, 359, 200} {
		code, body := request(t, router, http.MethodPut, "/user/color", map[string]any{"colorHue": hue})
		if code != http.StatusOK || body["colorHue"] != float64(hue) {
			t.Fatalf("picking hue %d: status %d %v, want 200 with the hue", hue, code, body)
		}
		if got := picked(); got == nil || *got != hue {
			t.Errorf("hue after picking %d = %v", hue, got)
		}
	}

	code, body := request(t, router, http.MethodPut, "/user/color", map[string]any{"colorHue": nil})
	if v, ok := body["colorHue"]; code != http.StatusOK || !ok || v != nil {
		t.Fatalf("clearing the hue: status %d %v, want 200 with colorHue null", code, body)
	}
	if got := picked(); got != nil {
		t.Errorf("hue after clearing = %d, want none", *got)
	}
}

// Everyone who sees a friend sees their picked color, so it rides along on every user the profile sends
func TestFriendsColorOnProfile(t *testing.T) {
	_, repo := newEventsRouter(t, "")
	ctx := context.Background()
	dbtest.Exec(t, repo, `UPDATE users SET color_hue = 120 WHERE id = 'friend'`)
	dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt, created_by) VALUES ('2026-10-01', '[]', 'a penguin', 'friend')`)
	submit(t, repo, "sub1", "friend", "2026-10-01")
	dbtest.Exec(t, repo, `INSERT INTO comments (submission_id, user_id, text) VALUES ('sub1', 'friend', 'nice')`)

	is120 := func(hue *int) bool { return hue != nil && *hue == 120 }
	profile, err := queries.GetUserProfileFromDB(repo, ctx, "friend", "me", &config.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if !is120(profile.User.ColorHue) {
		t.Errorf("profile user hue = %v", profile.User.ColorHue)
	}
	if len(profile.Prompts) != 1 || !is120(profile.Prompts[0].User.ColorHue) ||
		len(profile.Prompts[0].Comments) != 1 || !is120(profile.Prompts[0].Comments[0].User.ColorHue) ||
		profile.Prompts[0].CreatedBy == nil || !is120(profile.Prompts[0].CreatedBy.ColorHue) {
		t.Errorf("friend's doodles are missing the friend's color: %+v", profile.Prompts)
	}

	// Someone who never picked one has no hue, so the app falls back to the color from their name
	me, err := queries.GetUserProfileFromDB(repo, ctx, "me", "me", &config.Config{})
	if err != nil || me.User.ColorHue != nil {
		t.Errorf("my hue = %v, %v; want none", me.User.ColorHue, err)
	}
}
