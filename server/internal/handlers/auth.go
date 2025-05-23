package handlers

import (
	"database/sql"
	"errors"
	"log"
	"net/http"

	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/email"
	"drawer-service-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func HandleVerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing verification token"})
		return
	}

	// Get database connection from context
	repo := middleware.GetDB(c)

	// Verify the token
	user, err := db.VerifyToken(repo, c.Request.Context(), token)
	if err != nil {
		log.Printf("Token verification failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification token"})
		return
	}

	// Set the auth cookie
	c.SetCookie("auth", user.ID, 30*24*60*60, "/", "", true, true)

	// Redirect to the app
	c.Redirect(http.StatusSeeOther, "/app/")
}

func HandleLogin(c *gin.Context) {
	var loginReq struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&loginReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get database connection from context
	repo := middleware.GetDB(c)

	// Get or create user
	user, err := db.GetUserByEmail(repo, c.Request.Context(), loginReq.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Create new user
			userID, err := db.CreateUser(repo, c.Request.Context(), "", loginReq.Email)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
				return
			}
			user = &db.User{ID: userID, Email: loginReq.Email}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
	}

	// Create verification token
	token, err := db.CreateVerificationToken(repo, c.Request.Context(), user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create verification token"})
		return
	}

	// Send verification email
	cfg := middleware.GetConfig(c)
	if err := email.SendVerificationEmail(cfg, user.Email, token); err != nil {
		log.Printf("Failed to send verification email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Verification email sent",
	})
}
