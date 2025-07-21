package handlers

import (
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func HandleGetAdminDashboard(c *gin.Context) {
	adminUser := middleware.GetUser(c)
	appCtx := context.GetCtx(c)

	// Get search query from query parameters
	searchQuery := c.Query("search")

	// Get all users with optional search
	users, err := queries.GetAllUsers(appCtx.DB, c.Request.Context(), searchQuery)
	if err != nil {
		log.Printf("Error fetching users for admin dashboard: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	// Get future prompts
	futurePrompts, err := queries.GetFuturePrompts(appCtx.DB, c.Request.Context())
	if err != nil {
		log.Printf("Error fetching future prompts for admin dashboard: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch future prompts"})
		return
	}

	// --- Platform Stats ---
	totalUsers, _ := queries.GetTotalUserCount(appCtx.DB, c.Request.Context())
	totalDrawings, _ := queries.GetTotalDrawingCount(appCtx.DB, c.Request.Context())
	totalReactions, _ := queries.GetTotalReactionCount(appCtx.DB, c.Request.Context())
	totalComments, _ := queries.GetTotalCommentCount(appCtx.DB, c.Request.Context())

	drawingsToday, _ := queries.GetDrawingsToday(appCtx.DB, c.Request.Context())
	reactionsToday, _ := queries.GetReactionsToday(appCtx.DB, c.Request.Context())
	commentsToday, _ := queries.GetCommentsToday(appCtx.DB, c.Request.Context())
	recentUsers, _ := queries.GetRecentUsers(appCtx.DB, c.Request.Context(), 7, 10)

	c.JSON(http.StatusOK, gin.H{
		"message": "Admin dashboard access granted",
		"admin": gin.H{
			"id":       adminUser.ID,
			"username": adminUser.Username,
			"email":    adminUser.Email,
		},
		"users": users,
		"futurePrompts": futurePrompts,
		"stats": gin.H{
			"overall": gin.H{
				"totalUsers":     totalUsers,
				"totalDrawings":  totalDrawings,
				"totalReactions": totalReactions,
				"totalComments":  totalComments,
			},
			"today": gin.H{
				"drawingsToday":  drawingsToday,
				"reactionsToday": reactionsToday,
				"commentsToday":  commentsToday,
			},
			"recentUsers": recentUsers,
		},
	})
}

func HandleImpersonateUser(c *gin.Context) {
	adminUser := middleware.GetUser(c)
	appCtx := context.GetCtx(c)

	// Get the user ID to impersonate from the request body
	var body struct {
		UserID string `json:"userId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Printf("Invalid impersonate user request body: %v", err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if body.UserID == "" {
		log.Printf("Empty user ID provided in impersonate request")
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	// Verify the user exists
	user, err := queries.GetUserByID(appCtx.DB, c.Request.Context(), body.UserID)
	if err != nil {
		log.Printf("Error fetching user to impersonate (ID: %s): %v", body.UserID, err)
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Set a cookie to impersonate the user
	c.SetCookie("user_id", user.ID, 3600, "/", "", false, true) // 1 hour, secure in production

	log.Printf("Admin user %s (email: %s) impersonating user %s (username: %s)",
		adminUser.ID, utils.MaskEmail(adminUser.Email), user.ID, user.Username)

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully impersonating user",
		"impersonatedUser": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
		},
	})
}

// CreatePromptRequest represents the request body for creating/updating a prompt
type CreatePromptRequest struct {
	Day    string   `json:"day" binding:"required"`
	Prompt string   `json:"prompt" binding:"required"`
	Colors []string `json:"colors" binding:"required"`
}

func HandleCreatePrompt(c *gin.Context) {
	adminUser := middleware.GetUser(c)
	appCtx := context.GetCtx(c)

	var req CreatePromptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Invalid create prompt request body: %v", err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Validate colors array
	if len(req.Colors) == 0 {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "At least one color is required"})
		return
	}

	// Validate color format (basic hex validation)
	for _, color := range req.Colors {
		if len(color) != 7 || color[0] != '#' {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid color format. Colors must be hex format (e.g., #FF0000)"})
			return
		}
	}

	// Check if prompt already exists for this day
	_, err := queries.GetDailyPrompt(appCtx.DB, c.Request.Context(), req.Day)
	if err == nil {
		// Prompt exists, update it instead
		err = queries.UpdateDailyPrompt(appCtx.DB, c.Request.Context(), req.Day, req.Prompt, req.Colors)
		if err != nil {
			log.Printf("Error updating prompt for day %s: %v", req.Day, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update prompt"})
			return
		}

		log.Printf("Admin user %s updated prompt for day %s", adminUser.ID, req.Day)
		c.JSON(http.StatusOK, gin.H{
			"message": "Prompt updated successfully",
			"day":     req.Day,
		})
		return
	}

	// Prompt doesn't exist, create new one
	err = queries.CreateDailyPrompt(appCtx.DB, c.Request.Context(), req.Day, req.Prompt, req.Colors)
	if err != nil {
		log.Printf("Error creating prompt for day %s: %v", req.Day, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to create prompt"})
		return
	}

	log.Printf("Admin user %s created prompt for day %s", adminUser.ID, req.Day)
	c.JSON(http.StatusOK, gin.H{
		"message": "Prompt created successfully",
		"day":     req.Day,
	})
}

// HandleGetAdminActionStats returns daily action stats for a date range
func HandleGetAdminActionStats(c *gin.Context) {
	appCtx := context.GetCtx(c)
	start := c.Query("start")
	end := c.Query("end")
	if start == "" || end == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Missing start or end date"})
		return
	}
	stats, err := queries.GetDailyActionStats(appCtx.DB, c.Request.Context(), start, end)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch action stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
} 