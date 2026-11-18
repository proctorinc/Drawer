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
	router.GET("/events/:slug/leaderboard", HandleGetEventLeaderboard)
	router.GET("/events/:slug/recap", HandleGetEventRecap)
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
}

func TestAdminEvents(t *testing.T) {
	router, _ := newEventsRouter(t, "")
	valid := map[string]any{
		"slug": "spooky-2027", "name": "Spooky", "theme": "halloween",
		"startsAt": "2027-10-29T00:00:00Z", "endsAt": "2027-11-01T00:00:00Z",
		"countdownDays": nil, "reactions": []string{"pumpkin"},
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
	always := map[string]bool{"heart": true}
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
			got, err = isReactionAllowed(c, always, tt.reaction)
			c.JSON(http.StatusOK, gin.H{})
		})
		request(t, router, "GET", "/check", nil)
		if err != nil || got != tt.want {
			t.Errorf("%s on %s: allowed = %v, %v; want %v", tt.reaction, tt.fakeNow, got, err, tt.want)
		}
	}
}
