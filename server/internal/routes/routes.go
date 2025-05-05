package routes

import (
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/handlers"
	"drawer-service-backend/internal/middleware"
	"log"

	"github.com/gin-gonic/gin"
)

func InitRouter(cfg *config.Config, repo *sql.DB) *gin.Engine {
	router := gin.Default()
	router.Use(middleware.CorsMiddleware())
	router.Use(middleware.ContextMiddleware(cfg, repo))

	// --- API Routes ---
	router.POST("/register", handlers.HandleCreateUser)
	router.POST("/login", handlers.HandleLoginUser)
	log.Printf("Serving static files from '%s' at route '/uploads'", cfg.UploadDir)

	// Authenticated group
	authGroup := router.Group("/")
	authGroup.Use(middleware.AuthMiddleware(repo))
	{
		authGroup.POST("/logout", handlers.HandleLogoutUser)
		authGroup.POST("/add-friend/:friendID", handlers.HandleAddFriend)
		authGroup.GET("/daily", handlers.HandleGetDaily)
		authGroup.POST("/daily", handlers.HandlePostDaily)
		authGroup.GET("/me", handlers.HandleGetUser)
		authGroup.Static("/uploads", cfg.UploadDir)
	}

	return router
}
