package routes

import (
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/handlers"
	"drawer-service-backend/internal/middleware"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

func InitRouter(cfg *config.Config, repo *sql.DB) *gin.Engine {
	router := gin.Default()
	router.Use(middleware.CorsMiddleware(cfg))
	router.Use(middleware.ContextMiddleware(cfg, repo))

	if cfg.Env == "production" {
		router.NoRoute(func(c *gin.Context) {
			requestedPath := c.Request.URL.Path
			staticFilePath := filepath.Join("./frontend", requestedPath)

			if _, err := os.Stat(staticFilePath); err == nil {
				c.File(staticFilePath)
				return
			}

			// If the request path doesn't match any route and isn't a static file, return a 404
			c.Status(http.StatusNotFound)
		})
		frontendGroup := router.Group("/app")
		frontendGroup.GET("/*filepath", func(c *gin.Context) {
			c.File("./frontend/index.html")
		})
	}

	// API routes
	apiGroup := router.Group("/api/v1")
	{
		// Auth routes
		apiGroup.POST("/register", handlers.HandleRegister)
		apiGroup.POST("/login", handlers.HandleLogin)
		apiGroup.GET("/verify", handlers.HandleVerifyEmail)

		// Authenticated routes
		authGroup := apiGroup.Group("/")
		authGroup.Use(middleware.AuthMiddleware(repo))
		{
			authGroup.POST("/logout", handlers.HandleLogout)
			authGroup.POST("/add-friend", handlers.HandleAddFriend)
			authGroup.GET("/daily", handlers.HandleGetDaily)
			authGroup.POST("/daily", handlers.HandlePostDaily)
			authGroup.GET("/me", handlers.HandleGetUser)
			authGroup.GET("/user/:id", handlers.HandleGetUserByID)
			authGroup.PUT("/update-username", handlers.HandleUpdateUsername)
			authGroup.GET("/submission/:id", handlers.HandleGetPromptSubmissionByID)
			authGroup.POST("/submission/:id/comment", handlers.HandleAddCommentToSubmission)
			authGroup.POST("/submission/:id/reaction", handlers.HandleToggleSubmissionReaction)
			authGroup.POST("/comment/:id/reaction", handlers.HandleToggleCommentReaction)
		}
	}

	return router
}
