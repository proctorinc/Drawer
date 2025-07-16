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
		frontendGroup := router.Group("/draw")
		frontendGroup.GET("/*filepath", func(c *gin.Context) {
			c.File("./frontend/index.html")
		})
	}

	// API routes
	apiGroup := router.Group("/api/v1")
	{
		// Auth routes
		apiGroup.POST("/auth/register", handlers.HandleRegister)
		apiGroup.POST("/auth/login", handlers.HandleLogin)
		apiGroup.GET("/auth/verify", handlers.HandleVerifyEmail)

		// Authenticated routes
		authGroup := apiGroup.Group("/")
		authGroup.Use(middleware.AuthMiddleware(repo))
		{
			userGroup := authGroup.Group("/user")

			userGroup.GET("/me", handlers.HandleGetUser)
			userGroup.PUT("/me/username", handlers.HandleUpdateUsername)
			userGroup.GET("/me/profile", handlers.HandleGetUserProfile)
			userGroup.GET("/:id/profile", handlers.HandleGetUserByID)
			userGroup.POST("/add-friend", handlers.HandleAddFriend)


			submissionGroup := authGroup.Group("/submission")

			submissionGroup.GET("/daily", handlers.HandleGetDaily)
			submissionGroup.POST("/daily", handlers.HandlePostDaily)
			submissionGroup.GET("/:id", handlers.HandleGetPromptSubmissionByID)
			submissionGroup.POST("/:id/comment", handlers.HandleAddCommentToSubmission)
			submissionGroup.POST("/:id/reaction", handlers.HandleToggleSubmissionReaction)
			submissionGroup.POST("/:id/favorite", handlers.HandleToggleFavoriteSubmission)
			submissionGroup.POST(":id/comment/:reactionId/reaction", handlers.HandleToggleCommentReaction)

			// activityGroup := authGroup.Group("/activity")

			authGroup.GET("/activity", handlers.HandleGetActivity)
			authGroup.POST("/activity/view", handlers.HandlePostActivity)
			authGroup.POST("/favorite/swap", handlers.HandleSwapFavoriteOrder)

			authGroup.POST("/auth/logout", handlers.HandleLogout)
		}
	}

	return router
}
