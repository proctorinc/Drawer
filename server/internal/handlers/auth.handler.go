package handlers

import (
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
}

func HandleRegister(c *gin.Context) {
	appCtx := context.GetCtx(c)
	ctx := c.Request.Context()

	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Failed to bind JSON in HandleRegister. Error: %v, Body: %s", err, c.Request.Body)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Validate username
	if len(req.Username) < 2 {
		log.Printf("Invalid username length: %s", req.Username)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 2 characters long"})
		return
	}
	if len(req.Username) > 15 {
		log.Printf("Invalid username length: %s", req.Username)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username max length is 15 characters"})
		return
	}
	if strings.Contains(req.Username, " ") {
		log.Printf("Invalid username containing spaces: %s", req.Username)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username cannot contain spaces"})
		return
	}

	clerkID := middleware.GetClerkUserID(c)
	email, err := middleware.GetVerifiedClerkEmail(ctx, clerkID)
	if err != nil {
		log.Printf("Failed to get verified email for Clerk user %s: %v", clerkID, err)
		c.JSON(http.StatusForbidden, gin.H{"error": "A verified email is required"})
		return
	}

	user, err := queries.CreateClerkUser(appCtx.DB, ctx, clerkID, req.Username, email)
	if err != nil {
		log.Printf("Failed to create user for %s: %v", utils.MaskEmail(email), err)
		if strings.Contains(err.Error(), "users.username") {
			c.JSON(http.StatusConflict, gin.H{"error": "That username is taken"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusOK, user.Account())
}

// HandleLogout ends any admin impersonation; the Clerk session itself is signed out on the frontend.
func HandleLogout(c *gin.Context) {
	removeImpersonationCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func removeImpersonationCookie(c *gin.Context) {
	cookie := &http.Cookie{
		Name:     middleware.ImpersonateCookie,
		Value:    "",
		Expires:  time.Now().Add(-1), // Expires now
		Path:     "/",
		HttpOnly: true,
	}

	http.SetCookie(c.Writer, cookie)
}
