package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestLegacyDomainRedirect(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(LegacyDomainRedirect("https://doodle.mattyp.app/"))
	router.Any("/*path", func(c *gin.Context) { c.Status(http.StatusOK) })

	tests := []struct {
		method, host, target string
		wantStatus           int
		wantLocation         string
	}{
		{"GET", "daily-doodle.app", "/draw/feed?day=2026-12-01", http.StatusMovedPermanently, "https://doodle.mattyp.app/draw/feed?day=2026-12-01"},
		{"HEAD", "WWW.Daily-Doodle.app:443", "/", http.StatusMovedPermanently, "https://doodle.mattyp.app/"},
		{"POST", "daily-doodle.app", "/api/v1/submit", http.StatusPermanentRedirect, "https://doodle.mattyp.app/api/v1/submit"},
		{"GET", "doodle.mattyp.app", "/draw", http.StatusOK, ""},
		{"GET", "drawer-abc-uc.a.run.app", "/draw", http.StatusOK, ""},
	}

	for _, tt := range tests {
		req := httptest.NewRequest(tt.method, tt.target, nil)
		req.Host = tt.host
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != tt.wantStatus || rec.Header().Get("Location") != tt.wantLocation {
			t.Errorf("%s %s%s = %d %q, want %d %q", tt.method, tt.host, tt.target,
				rec.Code, rec.Header().Get("Location"), tt.wantStatus, tt.wantLocation)
		}
	}
}

// An old or missing ALLOWED_ORIGINS must leave the old domain serving, not loop or go to localhost
func TestLegacyDomainRedirectIgnoresUnusableOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, origin := range []string{"https://daily-doodle.app", "http://localhost:3000", ""} {
		router := gin.New()
		router.Use(LegacyDomainRedirect(origin))
		router.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

		req := httptest.NewRequest("GET", "/", nil)
		req.Host = "daily-doodle.app"
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("origin %q: got %d, want 200", origin, rec.Code)
		}
	}
}
