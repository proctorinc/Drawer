package routes

import (
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/handlers"
	"drawer-service-backend/internal/middleware"
	"log"
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
	serverGroup := router.Group("/api/v1")
	serverGroup.POST("/register", handlers.HandleRegister)
	serverGroup.POST("/login", handlers.HandleLogin)
	log.Printf("Serving static files from '%s' at route 'server/uploads'", cfg.UploadDir)

	// Authenticated group
	authGroup := serverGroup.Group("/")
	authGroup.Use(middleware.AuthMiddleware(repo))
	{
		authGroup.POST("/logout", handlers.HandleLogout)
		authGroup.POST("/add-friend/:friendID", handlers.HandleAddFriend)
		authGroup.GET("/daily", handlers.HandleGetDaily)
		authGroup.POST("/daily", handlers.HandlePostDaily)
		authGroup.GET("/me", handlers.HandleGetUser)
		authGroup.Static("/uploads", cfg.UploadDir)
	}

	// Auth routes
	router.POST("/api/auth/login", handlers.HandleLogin)
	router.GET("/api/auth/verify", handlers.HandleVerifyEmail)

	return router
}
