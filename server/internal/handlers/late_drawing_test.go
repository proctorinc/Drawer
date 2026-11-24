package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// dailyRig is the daily-drawing API over a test database, with a prompt for each of the
// last few days and players amy and bo (bo joined two weeks ago).
type dailyRig struct {
	repo   *sql.DB
	router *gin.Engine
	days   []string // today first, then each day before it
}

func newDailyRig(t *testing.T) *dailyRig {
	t.Helper()
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	now := time.Now()
	var days []string
	for i := 0; i < 30; i++ {
		day := utils.GetFormattedDate(now.AddDate(0, 0, -i))
		days = append(days, day)
		dbtest.Exec(t, repo, `INSERT INTO daily_prompts (day, colors, prompt) VALUES (?, '["#111111","#222222","#333333"]', ?)`, day, "prompt "+day)
	}
	// Joined at the start of a day, so it's the same day on any clock the test runs on
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email, role, created_at) VALUES
		('amy', 'amy', 'a@x', 'user', ?), ('bo', 'bo', 'b@x', 'user', ?), ('admin', 'admin', 'c@x', 'admin', ?)`,
		days[29]+" 00:00:00", days[14]+" 00:00:00", days[29]+" 00:00:00")
	cfg := &config.Config{Env: "development"}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		id := c.GetHeader("X-As")
		role := "user"
		if id == "admin" {
			role = "admin"
		}
		c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: cfg})
		c.Set(middleware.UserContextKey, models.User{ID: id, Username: id, Role: role})
		c.Set(middleware.UserIDContextKey, id)
	})
	router.GET("/submission/daily", HandleGetDailyPrompt)
	router.POST("/submission/daily", HandleSubmitDailyPrompt)
	router.POST("/submission/daily/start", HandleStartDailyDrawing)
	router.GET("/submission/daily/unfinished", HandleGetUnfinishedPrompt)
	router.GET("/submission/redos", HandleGetRedos)
	router.GET("/submission/:id", HandleGetSubmissionByID)
	router.GET("/settings", HandleGetAppSettings)
	router.GET("/admin/redos", HandleAdminListRedos)
	router.GET("/admin/users/:id/days", HandleAdminPlayerDays)
	router.POST("/admin/redos", HandleAdminGrantRedos)
	router.DELETE("/admin/redos/:id", HandleAdminRevokeRedo)
	router.PUT("/admin/settings", HandleAdminUpdateAppSettings)
	return &dailyRig{repo: repo, router: router, days: days}
}

// submit pins a drawing as who, for day ("" sends none, like older apps).
func (r *dailyRig) submit(t *testing.T, who, day string) (int, map[string]any) {
	t.Helper()
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	part, _ := form.CreateFormFile("image", "drawing.png")
	part.Write([]byte("png"))
	if day != "" {
		form.WriteField("day", day)
	}
	form.Close()
	req := httptest.NewRequest("POST", "/submission/daily", &body)
	req.Header.Set("Content-Type", form.FormDataContentType())
	req.Header.Set("X-As", who)
	rec := httptest.NewRecorder()
	r.router.ServeHTTP(rec, req)
	var decoded map[string]any
	json.Unmarshal(rec.Body.Bytes(), &decoded)
	return rec.Code, decoded
}

// A doodle the rollover interrupted: started yesterday, pinned today against yesterday's prompt.
func TestFinishingYesterdaysDrawing(t *testing.T) {
	rig := newDailyRig(t)
	repo, router := rig.repo, rig.router
	today, yesterday, twoDaysAgo := rig.days[0], rig.days[1], rig.days[2]
	submit := func(who, day string) (int, map[string]any) {
		t.Helper()
		return rig.submit(t, who, day)
	}
	unfinished := func(who string) any {
		t.Helper()
		code, body := requestAs(t, router, who, "GET", "/submission/daily/unfinished", nil)
		if code != http.StatusOK {
			t.Fatalf("unfinished for %s: %d", who, code)
		}
		return body["prompt"]
	}

	// Nothing started: nothing to finish, and a late submit is refused
	if p := unfinished("amy"); p != nil {
		t.Errorf("amy has nothing started but got %v", p)
	}
	if code, _ := submit("amy", yesterday); code != http.StatusConflict {
		t.Errorf("late submit without a start: %d, want 409", code)
	}

	// Starting records today, and starting again is harmless
	req := httptest.NewRequest("POST", "/submission/daily/start", nil)
	req.Header.Set("X-As", "amy")
	for range 2 {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("start: %d", rec.Code)
		}
	}
	var startedDay string
	repo.QueryRow(`SELECT day FROM drawing_starts WHERE user_id = 'amy'`).Scan(&startedDay)
	if startedDay != today {
		t.Errorf("start recorded for %q, want today %q", startedDay, today)
	}

	// Pretend that start was yesterday (the prompt has since rolled over), and that bo
	// started two days ago, which is past the grace
	dbtest.Exec(t, repo, `UPDATE drawing_starts SET day = ? WHERE user_id = 'amy'`, yesterday)
	dbtest.Exec(t, repo, `INSERT INTO drawing_starts (user_id, day) VALUES ('bo', ?)`, twoDaysAgo)

	p, ok := unfinished("amy").(map[string]any)
	if !ok || p["day"] != yesterday || p["prompt"] != "prompt "+yesterday {
		t.Fatalf("amy's unfinished prompt = %v, want yesterday's", p)
	}
	if p := unfinished("bo"); p != nil {
		t.Errorf("bo's start is two days old but got %v", p)
	}
	if code, _ := submit("bo", twoDaysAgo); code != http.StatusConflict {
		t.Errorf("submit past the grace: %d, want 409", code)
	}

	code, body := submit("amy", yesterday)
	if code != http.StatusCreated || body["day"] != yesterday || body["late"] != true {
		t.Fatalf("late submit: %d %v", code, body)
	}
	lateID := body["id"].(string)

	// It's done: nothing left to finish, a second go is refused, and today is still open
	if p := unfinished("amy"); p != nil {
		t.Errorf("after pinning, still unfinished: %v", p)
	}
	if code, _ := submit("amy", yesterday); code != http.StatusServiceUnavailable {
		t.Errorf("second late submit: %d, want 503 (already pinned)", code)
	}
	if code, body := requestAs(t, router, "amy", "GET", "/submission/daily", nil); code != http.StatusOK || body["isCompleted"] != false {
		t.Errorf("today after a late pin: %d %v, want not completed", code, body)
	}
	code, body = submit("amy", today)
	if code != http.StatusCreated || body["day"] != today || body["late"] != false {
		t.Fatalf("today's submit: %d %v", code, body)
	}
	// Older apps send no day: that's today's, already pinned
	if code, _ := submit("amy", ""); code != http.StatusServiceUnavailable {
		t.Errorf("third submit: %d, want 503", code)
	}

	// The late one says so; today's doesn't
	if code, body := requestAs(t, router, "amy", "GET", "/submission/"+lateID, nil); code != http.StatusOK || body["late"] != true {
		t.Errorf("late submission: %d late=%v", code, body["late"])
	}
	subs := []*models.UserPromptSubmission{{ID: lateID}, {ID: body["id"].(string)}}
	if err := queries.AttachSubmissionFlags(repo, context.Background(), subs); err != nil {
		t.Fatal(err)
	}
	if !subs[0].Late || subs[1].Late {
		t.Errorf("late flags = %v, %v; want true, false", subs[0].Late, subs[1].Late)
	}
}

// requestAsRaw makes a request with no body and doesn't expect JSON back.
func requestAsRaw(t *testing.T, r *dailyRig, who, method, path string) (int, string) {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	req.Header.Set("X-As", who)
	rec := httptest.NewRecorder()
	r.router.ServeHTTP(rec, req)
	return rec.Code, rec.Body.String()
}
