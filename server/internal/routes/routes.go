package routes

import (
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/handlers"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/notifications"
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
		frontendGroup := router.Group("/draw")
		frontendGroup.GET("/*filepath", func(c *gin.Context) {
			c.File("./frontend/index.html")
		})

		frontendAuthGroup := router.Group("/auth")
		frontendAuthGroup.GET("/*filepath", func(c *gin.Context) {
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

			userGroup.GET("/me", handlers.HandleGetMe)
			userGroup.PUT("/me/username", handlers.HandleUpdateUsername)
			userGroup.GET("/me/profile", handlers.HandleGetUserProfile)
			userGroup.GET("/:id/profile", handlers.HandleGetUserByID)
			userGroup.GET("/invitations", handlers.HandleGetInvitations)
			userGroup.POST("/:id/invite", handlers.HandleInviteFriend)
			userGroup.POST("/:id/accept-invitation", handlers.HandleAcceptInvitation)
			userGroup.POST("/:id/deny-invitation", handlers.HandleDenyInvitation)

			submissionGroup := authGroup.Group("/submission")

			submissionGroup.GET("/daily", handlers.HandleGetDailyPrompt)
			submissionGroup.POST("/daily", handlers.HandleSubmitDailyPrompt)
			submissionGroup.GET("/:id", handlers.HandleGetSubmissionByID)
			submissionGroup.POST("/:id/comment", handlers.HandleAddCommentToSubmission)
			submissionGroup.POST("/:id/reaction", handlers.HandleSubmissionToggleReaction)
			submissionGroup.POST("/:id/favorite", handlers.HandleSubmissionToggleFavorite)
			submissionGroup.POST("/:id/comment/:reactionId/reaction", handlers.HandleCommentToggleReaction)

			authGroup.GET("/activity", handlers.HandleGetActivity)
			authGroup.POST("/activity/view", handlers.HandlePostActivity)
			authGroup.POST("/favorite/swap", handlers.HandleSwapFavoriteOrder)

			authGroup.POST("/notifications/subscribe", handlers.HandleSubscribePush)
			authGroup.POST("/notifications/unsubscribe", handlers.HandleUnsubscribePush)

			// Development-only debug endpoints for push notifications
			log.Printf("🔔 Current environment: %s", cfg.Env)
			if cfg.Env == "development" || true { // Temporarily force debug endpoints
				log.Println("🔔 Debug endpoints registered for development")
				authGroup.GET("/notifications/debug", func(c *gin.Context) {
					log.Println("🔔 Debug endpoint called")
					user := middleware.GetUser(c)

					log.Printf("🔔 User: %s (%s)", user.ID, user.Username)

					// Check VAPID keys
					vapidPublicSet := cfg.VAPIDPublicKey != ""
					vapidPrivateSet := cfg.VAPIDPrivateKey != ""
					log.Printf("🔔 VAPID keys - Public: %t, Private: %t", vapidPublicSet, vapidPrivateSet)

					// Get user's subscriptions
					log.Println("🔔 Getting subscriptions...")
					subscriptions, err := queries.GetUserPushSubscriptions(repo, c.Request.Context(), user.ID)
					if err != nil {
						log.Printf("🔔 Error getting subscriptions: %v", err)
						c.JSON(500, gin.H{"error": "Failed to get subscriptions: " + err.Error()})
						return
					}
					log.Printf("🔔 Found %d subscriptions", len(subscriptions))

					// Get user's friends
					log.Println("🔔 Getting friends...")
					friends, err := queries.GetUserFriends(repo, c.Request.Context(), user.ID)
					if err != nil {
						log.Printf("🔔 Error getting friends: %v", err)
						c.JSON(500, gin.H{"error": "Failed to get friends: " + err.Error()})
						return
					}
					log.Printf("🔔 Found %d friends", len(friends))

					response := gin.H{
						"vapid_public_set":   vapidPublicSet,
						"vapid_private_set":  vapidPrivateSet,
						"subscription_count": len(subscriptions),
						"friends_count":      len(friends),
						"user_id":            user.ID,
						"username":           user.Username,
					}

					log.Printf("🔔 Sending response: %+v", response)
					c.JSON(200, response)
				})

				authGroup.POST("/notifications/test", func(c *gin.Context) {
					user := middleware.GetUser(c)
					appCtx := context.GetCtx(c)

					data := models.NotificationData{
						Type:     models.NotificationTypeFriendSubmission,
						Title:    "Test Notification",
						Body:     "This is a test notification from the backend!",
						URL:      "/feed",
						UserID:   user.ID,
						Username: user.Username,
						Action:   "tested",
					}

					if err := notifications.SendNotificationToUser(repo, user.ID, data, appCtx.Config); err != nil {
						c.JSON(500, gin.H{"error": "Failed to send notification: " + err.Error()})
						return
					}

					c.JSON(200, gin.H{"message": "Test notification sent successfully"})
				})
			}

			authGroup.POST("/auth/logout", handlers.HandleLogout)

			// Admin routes (require admin role)
			adminGroup := authGroup.Group("/admin")
			adminGroup.Use(middleware.AdminMiddleware(repo))
			{
				// Admin dashboard endpoints will be added here
				adminGroup.GET("/dashboard", handlers.HandleGetAdminDashboard)
				adminGroup.POST("/impersonate", handlers.HandleImpersonateUser)
				adminGroup.POST("/prompt", handlers.HandleCreatePrompt)
				adminGroup.GET("/action-stats", handlers.HandleGetAdminActionStats)
			}
		}
	}

	return router
}
