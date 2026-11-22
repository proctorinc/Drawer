package handlers

import (
	"context"
	"drawer-service-backend/internal/config"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
)

// Losing the custom face unlock (say, a level reset) must not trap you in your drawn face
func TestToggleAvatarType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := dbtest.NewEventsDB(t)
	dbtest.Exec(t, repo, `INSERT INTO users (id, username, email, avatar_type) VALUES ('me', 'me', 'me@example.com', 'custom')`)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Like the auth middleware, load who's asking fresh on each request
		user, err := queries.GetUserByID(repo, c.Request.Context(), "me")
		if err != nil {
			t.Fatal(err)
		}
		c.Set(requestContext.AppContextKey, &requestContext.AppContext{DB: repo, Config: &config.Config{Env: "development"}})
		c.Set(middleware.UserContextKey, *user)
	})
	router.PUT("/user/profile-pic/toggle", HandleToggleAvatarType)

	avatarType := func() string {
		user, err := queries.GetUserByID(repo, context.Background(), "me")
		if err != nil {
			t.Fatal(err)
		}
		return user.AvatarType
	}
	toggle := func() int {
		code, _ := request(t, router, http.MethodPut, "/user/profile-pic/toggle", nil)
		return code
	}

	if code := toggle(); code != http.StatusOK {
		t.Fatalf("back to initials without the unlock: status %d, want 200", code)
	}
	if got := avatarType(); got != "basic" {
		t.Errorf("avatar type = %q, want basic", got)
	}

	if code := toggle(); code != http.StatusForbidden {
		t.Errorf("to a drawn face without the unlock: status %d, want 403", code)
	}
	if got := avatarType(); got != "basic" {
		t.Errorf("avatar type after a refused switch = %q, want basic", got)
	}
}
