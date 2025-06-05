package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/email"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
}

func HandleVerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		log.Printf("Missing verification token in request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing verification token"})
		return
	}

	// Get database connection from context
	repo := middleware.GetDB(c)

	// Verify the token
	user, err := db.VerifyToken(repo, c.Request.Context(), token)
	if err != nil {
		log.Printf("Token verification failed for token %s: %v", token, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification token"})
		return
	}

	setAuthCookie(c, user.ID)

	// Redirect to the app
	c.Redirect(http.StatusSeeOther, "/app/")
}

func HandleLogin(c *gin.Context) {
	cfg := middleware.GetConfig(c)

	var loginReq struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&loginReq); err != nil {
		log.Printf("Failed to bind JSON in HandleLogin: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Get database connection
	repo := middleware.GetDB(c)
	ctx := c.Request.Context()

	// Get user
	user, err := db.GetUserByEmail(repo, ctx, loginReq.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Printf("No account found for email: %s", utils.MaskEmail(loginReq.Email))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No account found with this email. Please register first."})
			return
		}
		log.Printf("Database error fetching user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "An error occurred while trying to log in. Please try again."})
		return
	}

	// Skip email verification for development environment
	if cfg.Env != "production" {
		setAuthCookie(c, user.ID)
		c.Redirect(http.StatusSeeOther, "/app/")
		return
	}

	// Create verification token
	token, err := db.CreateVerificationToken(repo, ctx, user.ID, user.Email)
	if err != nil {
		log.Printf("Failed to create verification token for user %s: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create verification token"})
		return
	}

	// Send verification email
	if err := email.SendVerificationEmail(cfg, user.Email, token); err != nil {
		log.Printf("Failed to send verification email: %v", err)
		// Don't return error to user, just log it
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Verification email sent. Please check your inbox to log in.",
	})
}

func HandleRegister(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in HandleRegister: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		}
	}()

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

	// Get database connection
	repo := middleware.GetDB(c)
	ctx := c.Request.Context()

	// Check if user already exists
	existingUser, err := db.GetUserByEmail(repo, ctx, req.Email)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Database error checking existing user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking user"})
		return
	}
	if existingUser != nil {
		log.Printf("existingUser: %+v", existingUser)
		log.Printf("User already exists with email: %s", utils.MaskEmail(req.Email))
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	// Create user
	user, err := db.CreateUser(repo, ctx, req.Username, req.Email)
	if err != nil {
		log.Printf("Failed to create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	cfg := middleware.GetConfig(c)

	// Skip email verification for development environment
	if cfg.Env != "production" {
		setAuthCookie(c, user.ID)
		c.Redirect(http.StatusSeeOther, "/app/")
		return
	}

	// Create verification token
	token, err := db.CreateVerificationToken(repo, ctx, user.ID, user.Email)
	if err != nil {
		log.Printf("Failed to create verification token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create verification token"})
		return
	}

	// Send verification email
	if err := email.SendVerificationEmail(cfg, req.Email, token); err != nil {
		log.Printf("Failed to send verification email: %v", err)
		// Don't return error to user, just log it
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Registration successful. Please check your email to verify your account.",
	})
}

func HandleLogout(c *gin.Context) {
	removeAuthCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func setAuthCookie(c *gin.Context, token string) {
	c.SetCookie("user_id", token, 30*24*60*60, "/", "", true, true)
}

func removeAuthCookie(c *gin.Context) {
	cookie := &http.Cookie{
		Name:     "user_id",
		Value:    "",
		Expires:  time.Now().Add(-1), // Expires now
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	}

	http.SetCookie(c.Writer, cookie)
}
