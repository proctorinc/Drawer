package handlers

import (
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// The secret checks come before any job runs, so these need no database
func TestCronTickNeedsTheSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name, configured, sent string
		want                   int
	}{
		{"off when unset", "", "", http.StatusNotFound},
		{"off when unset, even with a header", "", "anything", http.StatusNotFound},
		{"missing header", "s3cret", "", http.StatusUnauthorized},
		{"wrong secret", "s3cret", "guess", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.Use(func(c *gin.Context) {
				c.Set(requestContext.AppContextKey, &requestContext.AppContext{Config: &config.Config{CronSecret: tc.configured}})
			})
			router.POST("/cron/tick", HandleCronTick)
			req := httptest.NewRequest("POST", "/cron/tick", nil)
			if tc.sent != "" {
				req.Header.Set(CronSecretHeader, tc.sent)
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)
			if recorder.Code != tc.want {
				t.Errorf("got %d, want %d", recorder.Code, tc.want)
			}
		})
	}
}
