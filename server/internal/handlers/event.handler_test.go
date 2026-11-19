package handlers

import (
	"bytes"
	"database/sql"
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/middleware"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// newEventsRouter serves the event routes as "me", with "now" faked to fakeNow.
func newEventsRouter(t *testing.T, fakeNow string) (*gin.Engine, *sql.DB) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	cfg := &config.Config{Env: "development", EventsFakeNow: fakeNow}

	for _, id := range []string{"me", "friend"} {
		dbtest.Exec(t, repo, `INSERT INTO users (id, username, email) VALUES (?, ?, ?)`, id, id, id+"@example.com")
	}
	dbtest.Exec(t, repo, `INSERT INTO friendships (user1, user2, inviter_id, state) VALUES ('me', 'friend', 'me', 'accepted')`)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		c.Set(middleware.UserIDContextKey, "me")
		c.Set(middleware.UserContextKey, models.User{ID: "me", Username: "me"})
	})
	router.GET("/events/active", HandleGetActiveEvent)
	router.GET("/events/upcoming", HandleGetUpcomingEvent)
	router.GET("/user/:id/achievements", HandlerGetUserAchievements)
	router.GET("/events/:slug/leaderboard", HandleGetEventLeaderboard)
	router.GET("/events/:slug/recap", HandleGetEventRecap)
	router.GET("/trophies", HandleGetTrophies)
	router.GET("/admin/events", HandleAdminListEvents)
	router.POST("/admin/events", HandleAdminCreateEvent)
	router.PUT("/admin/events/:id", HandleAdminUpdateEvent)
	return router, repo
}

func request(t *testing.T, router *gin.Engine, method, path string, body any) (int, map[string]any) {
	t.Helper()
	var encoded []byte
	if body != nil {
		encoded, _ = json.Marshal(body)
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(method, path, bytes.NewReader(encoded)))

	var decoded map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("%s %s: invalid JSON %q", method, path, recorder.Body.String())
	}
	return recorder.Code, decoded
}

func submit(t *testing.T, repo *sql.DB, id, userID, day string) {
	dbtest.Exec(t, repo, `INSERT INTO user_submissions (id, user_id, day) VALUES (?, ?, ?)`, id, userID, day)
}

func TestActiveEventProgress(t *testing.T) {
	router, repo := newEventsRouter(t, "2026-12-05")
	submit(t, repo, "s0", "me", "2026-11-26")
	submit(t, repo, "s2", "me", "2026-11-29")
	submit(t, repo, "s1", "me", "2026-11-27")
	submit(t, repo, "f1", "friend", "2026-11-28")

	code, body := request(t, router, "GET", "/events/active", nil)
	if code != http.StatusOK {
		t.Fatalf("status %d: %v", code, body)
	}
	event := body["event"].(map[string]any)
	progress := event["progress"].(map[string]any)
	if days, _ := json.Marshal(progress["doodledDays"]); string(days) != `["2026-11-27","2026-11-29"]` || progress["count"] != 2.0 {
		t.Errorf("progress = %v", progress)
	}
	if reactions, _ := json.Marshal(event["reactions"]); string(reactions) != `["snowflake","gift"]` {
		t.Errorf("reactions = %s", reactions)
	}

	router, _ = newEventsRouter(t, "2027-01-01")
	if _, body := request(t, router, "GET", "/events/active", nil); body["event"] != nil {
		t.Errorf("event after the window = %v, want null", body["event"])
	}
}

func TestEventLeaderboardAndRecap(t *testing.T) {
	router, repo := newEventsRouter(t, "2026-12-05")
	submit(t, repo, "m1", "me", "2026-11-27")
	submit(t, repo, "m2", "me", "2026-11-28")
	submit(t, repo, "m3", "me", "2026-11-30")
	submit(t, repo, "f1", "friend", "2026-11-27")
	dbtest.Exec(t, repo, `INSERT INTO reactions (user_id, content_type, content_id, reaction_id) VALUES ('friend', 'submission', 'm1', 'gift')`)

	code, body := request(t, router, "GET", "/events/christmas-2026/leaderboard", nil)
	if code != http.StatusOK {
		t.Fatalf("leaderboard status %d: %v", code, body)
	}
	entries := body["entries"].([]any)
	first := entries[0].(map[string]any)
	if len(entries) != 2 || first["user"].(map[string]any)["id"] != "me" || first["doodles"] != 3.0 || first["reactionsReceived"] != 1.0 {
		t.Errorf("entries = %v", entries)
	}

	if code, _ := request(t, router, "GET", "/events/nope/leaderboard", nil); code != http.StatusNotFound {
		t.Errorf("unknown slug leaderboard status = %d, want 404", code)
	}
	if code, _ := request(t, router, "GET", "/events/nope/recap", nil); code != http.StatusNotFound {
		t.Errorf("unknown slug recap status = %d, want 404", code)
	}

	code, body = request(t, router, "GET", "/events/christmas-2026/recap", nil)
	if code != http.StatusOK {
		t.Fatalf("recap status %d: %v", code, body)
	}
	stats, _ := json.Marshal(body["stats"])
	if string(stats) != `{"doodles":3,"longestStreak":2,"reactionsReceived":1}` {
		t.Errorf("stats = %s", stats)
	}
	submissions := body["submissions"].([]any)
	if len(submissions) != 3 || submissions[0].(map[string]any)["prompt"] != "leftovers in disguise" {
		t.Errorf("submissions = %v", submissions)
	}
	if body["event"].(map[string]any)["progress"].(map[string]any)["count"] != 3.0 {
		t.Errorf("recap event progress = %v", body["event"])
	}
	if user := body["user"].(map[string]any); user["id"] != "me" {
		t.Errorf("own recap user = %v", user)
	}

	// Someone else's recap, as opened from their profile
	code, body = request(t, router, "GET", "/events/christmas-2026/recap?user=friend", nil)
	if code != http.StatusOK {
		t.Fatalf("friend recap status %d: %v", code, body)
	}
	if user := body["user"].(map[string]any); user["id"] != "friend" {
		t.Errorf("friend recap user = %v", user)
	}
	if body["event"].(map[string]any)["progress"].(map[string]any)["count"] != 1.0 {
		t.Errorf("friend recap progress = %v", body["event"])
	}
	if code, _ := request(t, router, "GET", "/events/christmas-2026/recap?user=nobody", nil); code != http.StatusNotFound {
		t.Errorf("unknown user recap status = %d, want 404", code)
	}
}

func TestEventRecapXP(t *testing.T) {
	router, repo := newEventsRouter(t, "2027-01-15") // after the event, so the totals are settled
	submit(t, repo, "m1", "me", "2026-11-27")
	submit(t, repo, "m2", "me", "2026-11-28")
	submit(t, repo, "m0", "me", "2026-11-26") // the day before: everyday, not event
	submit(t, repo, "f1", "friend", "2026-11-27")
	react := func(userID, contentID, reactionID, at string) {
		dbtest.Exec(t, repo, `INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at)
			VALUES (?, 'submission', ?, ?, ?)`, userID, contentID, reactionID, at)
	}
	react("friend", "m1", "gift", "2026-11-27 12:00:00")  // festive, received
	react("me", "f1", "snowflake", "2026-11-28 12:00:00") // festive, given
	react("me", "f1", "heart", "2026-11-28 12:00:00")     // everyday, given
	react("me", "f1", "gift", "2026-11-20 12:00:00")      // before the event
	dbtest.Exec(t, repo, `INSERT INTO user_achievements (user_id, achievement_id, created_at)
		VALUES ('me', 'christmas-2026-first-snow', '2026-11-27 12:00:00')`)

	code, body := request(t, router, "GET", "/events/christmas-2026/recap", nil)
	if code != http.StatusOK {
		t.Fatalf("recap status %d: %v", code, body)
	}
	xp, _ := json.Marshal(body["xp"])
	want := `{"lines":[` +
		`{"action":"Hang a doodle on the tree","count":2,"xp":20,"xpEach":10},` +
		`{"action":"Send a festive reaction","count":1,"xp":2,"xpEach":2},` +
		`{"action":"Get a festive reaction","count":1,"xp":1,"xpEach":1},` +
		`{"action":"Earn a christmas sticker","count":1,"xp":25,"xpEach":25}` +
		`],"total":50}` // 48 from the event, plus 2 for the heart
	if string(xp) != want {
		t.Errorf("xp = %s\nwant %s", xp, want)
	}
	if body["quests"] != nil {
		t.Errorf("quests after the event = %v, want none", body["quests"])
	}
}

func TestEventLeaderboardBreaksDoodleTiesByXP(t *testing.T) {
	router, repo := newEventsRouter(t, "2026-12-05")
	submit(t, repo, "m1", "me", "2026-11-27")
	submit(t, repo, "f1", "friend", "2026-11-27")
	// Same doodles, but the friend also commented during the event
	dbtest.Exec(t, repo, `INSERT INTO comments (user_id, submission_id, text, created_at)
		VALUES ('friend', 'm1', 'nice', '2026-11-28 12:00:00')`)

	_, body := request(t, router, "GET", "/events/christmas-2026/leaderboard", nil)
	entries, _ := json.Marshal(body["entries"])
	var got []struct {
		User    struct{ ID string }
		Doodles int
		XP      int
	}
	json.Unmarshal(entries, &got)
	if len(got) != 2 || got[0].User.ID != "friend" || got[0].XP != 13 || got[1].XP != 10 {
		t.Errorf("entries = %+v, want friend (13 XP) ahead of me (10 XP)", got)
	}
}

func TestEventQuestsReplaceTrophyQuests(t *testing.T) {
	router, repo := newEventsRouter(t, "2026-12-05")
	// Quests count this real week, like the trophy page's
	submit(t, repo, "today", "me", time.Now().Format("2006-01-02"))

	code, body := request(t, router, "GET", "/events/christmas-2026/recap", nil)
	if code != http.StatusOK {
		t.Fatalf("recap status %d: %v", code, body)
	}
	quests := body["quests"].(map[string]any)["quests"].([]any)
	first := quests[0].(map[string]any)
	if len(quests) != 4 || first["title"] != "Deck the tree" || first["progress"] != 1.0 {
		t.Errorf("event quests = %v", quests)
	}

	if _, body := request(t, router, "GET", "/events/christmas-2026/recap?user=friend", nil); body["quests"] != nil {
		t.Errorf("friend's recap quests = %v, want none", body["quests"])
	}

	code, body = request(t, router, "GET", "/trophies", nil)
	if code != http.StatusOK {
		t.Fatalf("trophies status %d: %v", code, body)
	}
	questsEvent, _ := body["questsEvent"].(map[string]any)
	if len(body["quests"].([]any)) != 0 || questsEvent["slug"] != "christmas-2026" {
		t.Errorf("trophies during the event: quests = %v, questsEvent = %v", body["quests"], body["questsEvent"])
	}

	router, _ = newEventsRouter(t, "2026-11-01")
	code, body = request(t, router, "GET", "/trophies", nil)
	if code != http.StatusOK || len(body["quests"].([]any)) != 4 || body["questsEvent"] != nil {
		t.Errorf("trophies outside the event: status %d, quests = %v, questsEvent = %v", code, body["quests"], body["questsEvent"])
	}
}

func TestAdminEvents(t *testing.T) {
	router, _ := newEventsRouter(t, "")
	valid := map[string]any{
		"slug": "spooky-2027", "name": "Spooky", "theme": "halloween",
		"startsAt": "2027-10-29T00:00:00Z", "endsAt": "2027-11-01T00:00:00Z",
		"countdownDays": nil, "reactions": []string{"snowflake"},
	}

	code, created := request(t, router, "POST", "/admin/events", valid)
	if code != http.StatusCreated || created["id"] == "" || created["countdownDays"] != nil {
		t.Fatalf("create: %d %v", code, created)
	}

	if code, _ := request(t, router, "POST", "/admin/events", valid); code != http.StatusConflict {
		t.Errorf("duplicate slug status = %d, want 409", code)
	}

	invalid := map[string]any{}
	for key, value := range valid {
		invalid[key] = value
	}
	invalid["slug"] = "other-2027"
	invalid["endsAt"] = "2027-10-28T00:00:00Z"
	if code, body := request(t, router, "POST", "/admin/events", invalid); code != http.StatusBadRequest {
		t.Errorf("ends before starts: %d %v, want 400", code, body)
	}

	valid["name"] = "Spookier"
	if code, body := request(t, router, "PUT", "/admin/events/"+created["id"].(string), valid); code != http.StatusOK || body["name"] != "Spookier" {
		t.Errorf("update: %d %v", code, body)
	}
	valid["slug"] = "christmas-2026"
	if code, _ := request(t, router, "PUT", "/admin/events/"+created["id"].(string), valid); code != http.StatusConflict {
		t.Errorf("update to a taken slug status = %d, want 409", code)
	}
	valid["slug"] = "brand-new"
	if code, _ := request(t, router, "PUT", "/admin/events/missing", valid); code != http.StatusNotFound {
		t.Errorf("update missing status = %d, want 404", code)
	}

	code, body := request(t, router, "GET", "/admin/events", nil)
	if list := body["events"].([]any); code != http.StatusOK || len(list) != 2 {
		t.Errorf("list: %d %v", code, body)
	}
}

func TestEventReactionsAllowedOnlyDuringEvent(t *testing.T) {
	tests := []struct {
		fakeNow, reaction string
		want              bool
	}{
		{"2026-12-05", "snowflake", true},
		{"2026-12-05", "gift", true},
		{"2026-12-05", "heart", true},
		{"2026-12-05", "pumpkin", false},
		{"2027-01-01", "snowflake", false},
		{"2027-01-01", "heart", true},
	}
	for _, tt := range tests {
		router, _ := newEventsRouter(t, tt.fakeNow)
		var got bool
		var err error
		router.GET("/check", func(c *gin.Context) {
			got, err = isReactionAllowed(c, tt.reaction)
			c.JSON(http.StatusOK, gin.H{})
		})
		request(t, router, "GET", "/check", nil)
		if err != nil || got != tt.want {
			t.Errorf("%s on %s: allowed = %v, %v; want %v", tt.reaction, tt.fakeNow, got, err, tt.want)
		}
	}
}

func TestEventStaysSecretUntilItStarts(t *testing.T) {
	// Eight days out: teased by name and dates, but nothing else is served
	router, _ := newEventsRouter(t, "2026-11-19")
	_, body := request(t, router, "GET", "/events/upcoming", nil)
	upcoming, _ := body["event"].(map[string]any)
	if upcoming == nil || upcoming["slug"] != "christmas-2026" || upcoming["startsAt"] != "2026-11-27T00:00:00Z" {
		t.Errorf("upcoming = %v", body["event"])
	}
	if upcoming["endsAt"] != "2027-01-01T00:00:00Z" || upcoming["countdownDays"] != float64(29) {
		t.Errorf("upcoming dates = %v to %v, countdown %v", upcoming["startsAt"], upcoming["endsAt"], upcoming["countdownDays"])
	}
	if len(upcoming) != 6 {
		t.Errorf("upcoming reveals %d fields, want only slug, name, theme, startsAt, endsAt and countdownDays", len(upcoming))
	}
	for _, path := range []string{"/events/christmas-2026/recap", "/events/christmas-2026/leaderboard"} {
		if code, _ := request(t, router, "GET", path, nil); code != http.StatusNotFound {
			t.Errorf("%s before the start = %d, want 404", path, code)
		}
	}
	countEventStickers := func(router *gin.Engine) int {
		_, body := request(t, router, "GET", "/user/me/achievements", nil)
		n := 0
		for _, a := range body["achievements"].([]any) {
			if a.(map[string]any)["eventSlug"] != nil {
				n++
			}
		}
		return n
	}
	if n := countEventStickers(router); n != 0 {
		t.Errorf("%d event stickers shown before the start, want 0", n)
	}

	// Too far out to tease
	router, _ = newEventsRouter(t, "2026-11-01")
	if _, body := request(t, router, "GET", "/events/upcoming", nil); body["event"] != nil {
		t.Errorf("upcoming 26 days out = %v, want null", body["event"])
	}

	// Once it starts it's no longer upcoming, and its stickers show
	router, _ = newEventsRouter(t, "2026-11-27")
	if _, body := request(t, router, "GET", "/events/upcoming", nil); body["event"] != nil {
		t.Errorf("upcoming on the first day = %v, want null", body["event"])
	}
	if n := countEventStickers(router); n != 3 {
		t.Errorf("%d event stickers shown during the event, want 3", n)
	}
	if code, _ := request(t, router, "GET", "/events/christmas-2026/recap", nil); code != http.StatusOK {
		t.Errorf("recap on the first day = %d, want 200", code)
	}

	// After it, unearned stickers go away again
	router, _ = newEventsRouter(t, "2027-01-05")
	if n := countEventStickers(router); n != 0 {
		t.Errorf("%d unearned event stickers shown after the event, want 0", n)
	}
}
