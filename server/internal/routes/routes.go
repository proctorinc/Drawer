package routes

import (
	"database/sql"
	"drawer-service-backend/internal/achievements"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/handlers"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/notifications"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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
				setFrontendCacheHeaders(c, requestedPath)
				c.File(staticFilePath)
				return
			}

			// If the request path doesn't match any route and isn't a static file, return a 404
			c.Status(http.StatusNotFound)
		})
		serveIndex := func(c *gin.Context) {
			setFrontendCacheHeaders(c, "/index.html")
			c.File("./frontend/index.html")
		}
		router.Group("/draw").GET("/*filepath", serveIndex)
		router.Group("/auth").GET("/*filepath", serveIndex)
	}

	// API routes
	apiGroup := router.Group("/api/v1")
	{
		// Cloud Scheduler calls this so timed pushes go out on time (see handlers/cron.handler.go)
		apiGroup.POST("/cron/tick", handlers.HandleCronTick)

		clerkGroup := apiGroup.Group("/")
		if cfg.DevAuthBypass {
			log.Printf("DEV_AUTH_BYPASS is on: every request is signed in as %s, Clerk is skipped", cfg.DevAuthUserID)
			clerkGroup.Use(middleware.DevSession(cfg.DevAuthUserID))
		} else {
			clerkGroup.Use(middleware.ClerkSessionRequired())
		}

		// Signed in to Clerk, but may not have a Drawer profile yet
		clerkGroup.POST("/auth/register", handlers.HandleRegister)
		clerkGroup.POST("/auth/logout", handlers.HandleLogout)
		clerkGroup.POST("/auth/stop-impersonating", handlers.HandleStopImpersonating)

		// Authenticated routes
		authGroup := clerkGroup.Group("/")
		authGroup.Use(middleware.AuthRequired(repo))
		{
			// App-wide settings admins choose for everyone
			authGroup.GET("/settings", handlers.HandleGetAppSettings)

			userGroup := authGroup.Group("/user")

			userGroup.GET("/me", handlers.HandleGetMe)
			userGroup.GET("/profile", handlers.HandleGetUserProfile)
			userGroup.GET("/achievements", handlers.HandlerGetMyAchievements)
			userGroup.GET("/achievements/all", handlers.HandlerGetAchievementCatalog)
			userGroup.POST("/achievements/celebrated", handlers.HandlerMarkAchievementsCelebrated)
			userGroup.GET("/invitations", handlers.HandleGetInvitations)
			userGroup.PUT("/username", handlers.HandleUpdateUsername)
			userGroup.POST("/profile-pic",
				middleware.RewardUnlockRequired(repo, achievements.CUSTOM_PROFILE_PIC),
				handlers.HandleUpdateAvatarUrl)
			userGroup.GET("/avatars", handlers.HandleGetMyAvatars)
			userGroup.PUT("/avatars/:slot/wear",
				middleware.RewardUnlockRequired(repo, achievements.CUSTOM_PROFILE_PIC),
				handlers.HandleWearAvatar)
			// Not gated: going back to initials has to work even after the unlock is lost.
			// The handler checks the unlock only when switching to a drawn face.
			userGroup.PUT("/profile-pic/toggle", handlers.HandleToggleAvatarType)
			userGroup.PUT("/decoration", handlers.HandleUpdateDecoration)

			userGroup.GET("/levels", handlers.HandleGetUserLevels)
			userGroup.GET("/:id/profile", handlers.HandleGetUserByID)
			userGroup.GET("/:id/achievements", handlers.HandlerGetUserAchievements)
			userGroup.GET("/:id/trophies", handlers.HandleGetUserTrophies)
			userGroup.POST("/:id/invite", handlers.HandleInviteFriend)
			userGroup.POST("/:id/accept-invitation", handlers.HandleAcceptInvitation)
			userGroup.POST("/:id/deny-invitation", handlers.HandleDenyInvitation)
			userGroup.POST("/:id/poke", handlers.HandlePokeFriend)

			submissionGroup := authGroup.Group("/submission")

			submissionGroup.GET("/daily", handlers.HandleGetDailyPrompt)
			submissionGroup.POST("/daily", handlers.HandleSubmitDailyPrompt)
			submissionGroup.POST("/daily/start", handlers.HandleStartDailyDrawing)
			submissionGroup.GET("/daily/unfinished", handlers.HandleGetUnfinishedPrompt)
			submissionGroup.GET("/redos", handlers.HandleGetRedos)
			submissionGroup.GET("/:id", handlers.HandleGetSubmissionByID)
			submissionGroup.POST("/:id/comment", handlers.HandleAddCommentToSubmission)
			submissionGroup.POST("/:id/reaction", handlers.HandleSubmissionToggleReaction)
			submissionGroup.POST("/:id/favorite", handlers.HandleSubmissionToggleFavorite)
			submissionGroup.POST("/:id/comment/:reactionId/reaction", handlers.HandleCommentToggleReaction)
			submissionGroup.DELETE("/:id/comment/:commentId", handlers.HandleDeleteComment)

			authGroup.GET("/activity", handlers.HandleGetActivity)
			authGroup.POST("/activity/view", handlers.HandlePostActivity)
			authGroup.POST("/favorite/swap", handlers.HandleSwapFavoriteOrder)

			authGroup.GET("/notifications/vapid-public-key", handlers.HandleGetVAPIDPublicKey)
			authGroup.POST("/notifications/subscribe", handlers.HandleSubscribePush)
			authGroup.POST("/notifications/unsubscribe", handlers.HandleUnsubscribePush)

			authGroup.POST("/prompt/suggest", handlers.SuggestPrompt)

			authGroup.GET("/trophies", handlers.HandleGetTrophies)
			authGroup.GET("/ai/judge/today", handlers.HandleGetTodaysJudge)
			authGroup.GET("/ai/judge/today/intro", handlers.HandleGetTodaysJudgeIntro)
			authGroup.POST("/ai/judge/today/pledge", handlers.HandleSaveJudgePledge)
			authGroup.GET("/ai/judge/today/pledges", handlers.HandleGetTodaysPledges)
			authGroup.POST("/ai/reviews/:submissionId/heard", handlers.HandleMarkAIReviewHeard)
			authGroup.GET("/events/active", handlers.HandleGetActiveEvent)
			authGroup.GET("/events/upcoming", handlers.HandleGetUpcomingEvent)
			authGroup.GET("/events/:slug/leaderboard", handlers.HandleGetEventLeaderboard)
			authGroup.GET("/events/:slug/recap", handlers.HandleGetEventRecap)
			authGroup.GET("/announcements", handlers.HandleGetAnnouncements)
			authGroup.POST("/announcements/seen", handlers.HandleMarkAnnouncementsSeen)

			// The beta zone: features tried out with a few people first
			betaGroup := authGroup.Group("/beta")
			betaGroup.Use(middleware.BetaRequired(repo))
			{
				betaGroup.GET("/duels", handlers.HandleListDuels)
				betaGroup.POST("/duels", handlers.HandleCreateDuel)
				betaGroup.GET("/duels/:id", handlers.HandleGetDuel)
				betaGroup.POST("/duels/:id/start", handlers.HandleStartDuelDrawing)
				betaGroup.POST("/duels/:id/drawing", handlers.HandleSubmitDuelDrawing)
				betaGroup.POST("/duels/:id/guess", handlers.HandleDuelGuess)
				betaGroup.POST("/duels/:id/nudge", handlers.HandleNudgeDuel)
				betaGroup.POST("/duels/:id/cancel", handlers.HandleCancelDuel)
			}

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
						URL:      "/draw",
						UserID:   user.ID,
						Username: user.Username,
						Action:   "tested",
					}

					// Only fail when no device got it: one stale device shouldn't
					// hide that the others were notified
					delivered, err := notifications.DeliverToUser(repo, user.ID, data, appCtx.Config)
					if delivered == 0 && err != nil {
						c.JSON(500, gin.H{"error": "Failed to send notification: " + err.Error()})
						return
					}
					response := gin.H{"message": fmt.Sprintf("Test notification sent to %d device(s)", delivered), "delivered": delivered}
					if err != nil {
						response["failed"] = err.Error()
					}
					c.JSON(200, response)
				})
			}

			// Admin routes (require admin role)
			adminGroup := authGroup.Group("/admin")
			adminGroup.Use(middleware.AdminRequired(repo))
			{
				// Admin dashboard endpoints will be added here
				adminGroup.GET("/dashboard", handlers.HandleGetAdminDashboard)
				adminGroup.POST("/impersonate", handlers.HandleImpersonateUser)
				adminGroup.POST("/prompt", handlers.HandleCreatePrompt)
				adminGroup.GET("/action-stats", handlers.HandleGetAdminActionStats)
				adminGroup.GET("/prompt-suggestions", handlers.GetAllPromptSuggestions)
				adminGroup.POST("/prompt-suggestions/:id/accept", handlers.HandleAcceptPromptSuggestion)
				adminGroup.DELETE("/prompt-suggestions/:id", handlers.HandleDismissPromptSuggestion)
				adminGroup.GET("/events", handlers.HandleAdminListEvents)
				adminGroup.POST("/events", handlers.HandleAdminCreateEvent)
				adminGroup.PUT("/events/:id", handlers.HandleAdminUpdateEvent)
				adminGroup.GET("/events/:id/stats", handlers.HandleAdminEventStats)
				adminGroup.GET("/users", handlers.HandleAdminListUsers)
				adminGroup.GET("/prompts", handlers.HandleAdminListPrompts)
				adminGroup.PUT("/prompts/:day/judge", handlers.HandleAdminSetPromptJudge)
				adminGroup.GET("/submissions", handlers.HandleAdminListSubmissions)
				adminGroup.GET("/achievements", handlers.HandleAdminListAchievements)
				adminGroup.GET("/rewards", handlers.HandleAdminListRewards)
				adminGroup.GET("/reactions", handlers.HandleAdminReactionUsage)
				adminGroup.GET("/progression", handlers.HandleAdminProgression)
				adminGroup.GET("/activity", handlers.HandleAdminActivityLog)
				adminGroup.PUT("/settings", handlers.HandleAdminUpdateAppSettings)
				adminGroup.GET("/redos", handlers.HandleAdminListRedos)
				adminGroup.GET("/users/:id/days", handlers.HandleAdminPlayerDays)
				adminGroup.POST("/redos", handlers.HandleAdminGrantRedos)
				adminGroup.DELETE("/redos/:id", handlers.HandleAdminRevokeRedo)
				adminGroup.GET("/ai/settings", handlers.HandleAdminGetAISettings)
				adminGroup.PUT("/ai/settings", handlers.HandleAdminUpdateAISettings)
				adminGroup.GET("/ai/personalities", handlers.HandleAdminListAIPersonalities)
				adminGroup.POST("/ai/personalities", handlers.HandleAdminCreateAIPersonality)
				adminGroup.PUT("/ai/personalities/:id", handlers.HandleAdminUpdateAIPersonality)
				adminGroup.DELETE("/ai/personalities/:id", handlers.HandleAdminDeleteAIPersonality)
				adminGroup.POST("/ai/test", handlers.HandleAdminTestAI)
				adminGroup.GET("/ai/runs", handlers.HandleAdminListAIRuns)
				adminGroup.POST("/ai/runs/:id/apply", handlers.HandleAdminApplyAIRun)
				adminGroup.GET("/ai/reviews", handlers.HandleAdminListAIReviews)
				adminGroup.POST("/ai/reviews/:submissionId/rerun", handlers.HandleAdminRerunAIReview)
				adminGroup.POST("/ai/reviews/:submissionId/replies/draft", handlers.HandleAdminDraftAIReplies)
				adminGroup.POST("/ai/reviews/:submissionId/replies", handlers.HandleAdminPostAIReplies)
				adminGroup.DELETE("/ai/replies/:id", handlers.HandleAdminDeleteAIReply)
				adminGroup.GET("/announcements", handlers.HandleAdminListAnnouncements)
				adminGroup.POST("/announcements", handlers.HandleAdminCreateAnnouncement)
				adminGroup.PUT("/announcements/:id", handlers.HandleAdminUpdateAnnouncement)
				adminGroup.DELETE("/announcements/:id", handlers.HandleAdminDeleteAnnouncement)
				adminGroup.DELETE("/announcements/:id/views", handlers.HandleAdminResetAnnouncementViews)
				adminGroup.GET("/beta", handlers.HandleAdminBeta)
				adminGroup.POST("/beta/testers", handlers.HandleAdminAddBetaTester)
				adminGroup.DELETE("/beta/testers/:id", handlers.HandleAdminRemoveBetaTester)
			}
		}
	}

	return router
}

// setFrontendCacheHeaders lets browsers keep Vite's hashed /assets/ files forever,
// since a new build gives them new names, but makes them check back for everything
// else (index.html above all) so a deploy shows up without a hard refresh.
func setFrontendCacheHeaders(c *gin.Context, requestedPath string) {
	if strings.HasPrefix(requestedPath, "/assets/") {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
		return
	}
	c.Header("Cache-Control", "no-cache")
}
