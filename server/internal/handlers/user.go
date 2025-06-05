package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func HandleGetUser(c *gin.Context) {
	user := middleware.GetUser(c)
	repo := middleware.GetDB(c)
	cfg := middleware.GetConfig(c)

	response, err := db.GetUserDataFromDB(repo, c.Request.Context(), user.ID, cfg)
	if err != nil {
		log.Printf("Error querying user data for userId: %s (email: %s): %v", user.ID, utils.MaskEmail(user.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare user response"})
		return
	}

	c.JSON(http.StatusCreated, response)
}

func HandleAddFriend(c *gin.Context) {
	// Get the friend's username from the body of the request
	var body struct {
		Username string `json:"username"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Printf("Invalid add friend request body: %v", err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	username := body.Username
	if username == "" {
		log.Printf("Empty username provided in request")
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Username is required"})
		return
	}

	requester := middleware.GetUser(c)
	repo := middleware.GetDB(c)

	// Look up the friend's user ID from their username
	var friendID string
	err := repo.QueryRowContext(c.Request.Context(), "SELECT id FROM users WHERE username = ?", username).Scan(&friendID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("Username '%s' not found when user %s (email: %s) attempted to add them as friend",
				username, requester.ID, utils.MaskEmail(requester.Email))
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		log.Printf("Error looking up username '%s' for user %s (email: %s): %v",
			username, requester.ID, utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to look up user"})
		return
	}

	if requester.ID == friendID {
		log.Printf("User %s (email: %s) attempted to add themselves as a friend", requester.ID, utils.MaskEmail(requester.Email))
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "You cannot add yourself as a friend"})
		return
	}

	// Check if friendship already exists
	var exists bool
	err = repo.QueryRowContext(c.Request.Context(), 
		"SELECT EXISTS(SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))",
		requester.ID, friendID, friendID, requester.ID).Scan(&exists)
	if err != nil {
		log.Printf("Error checking existing friendship between users %s and %s: %v",
			requester.ID, friendID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to check friendship status"})
		return
	}
	if exists {
		log.Printf("Friendship already exists between users %s and %s", requester.ID, friendID)
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "You are already friends with this user"})
		return
	}

	// Insert the friendship into the database
	insertSQL := `
		INSERT INTO friendships (user_id, friend_id) VALUES
			(?, ?),
			(?, ?)
		ON CONFLICT (user_id, friend_id) DO NOTHING
	`
	_, err = repo.ExecContext(c.Request.Context(), insertSQL, requester.ID, friendID, friendID, requester.ID)
	if err != nil {
		log.Printf("Error adding friend '%s' (ID: %s) for user %s (email: %s): %v",
			username, friendID, requester.ID, utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to add friend"})
		return
	}

	log.Printf("Successfully added friend '%s' (ID: %s) for user %s (email: %s)",
		username, friendID, requester.ID, utils.MaskEmail(requester.Email))
	c.JSON(http.StatusOK, gin.H{"message": "Friend added successfully"})
}

func HandleGetUserByID(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		log.Printf("Empty user ID provided in request")
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	repo := middleware.GetDB(c)

	// Query the user from the database
	var user db.User
	query := `
		SELECT id, email, username
		FROM users
		WHERE id = ?
	`
	err := repo.QueryRowContext(c.Request.Context(), query, userID).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("User ID '%s' not found", userID)
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		log.Printf("Error fetching user ID '%s': %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func HandleUpdateUsername(c *gin.Context) {
	// Get the new username from the request body
	var body struct {
		Username string `json:"username"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Printf("Invalid update username request body: %v", err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Validate username
	if len(body.Username) < 2 {
		log.Printf("Invalid username length: %s", body.Username)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 2 characters long"})
		return
	}
	if len(body.Username) > 15 {
		log.Printf("Invalid username length: %s", body.Username)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Username max length is 15 characters"})
		return
	}
	if strings.Contains(body.Username, " ") {
		log.Printf("Invalid username containing spaces: %s", body.Username)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Username cannot contain spaces"})
		return
	}

	user := middleware.GetUser(c)
	repo := middleware.GetDB(c)

	// Check if username is already taken
	var existingUserID string
	err := repo.QueryRowContext(c.Request.Context(), "SELECT id FROM users WHERE username = ? AND id != ?", body.Username, user.ID).Scan(&existingUserID)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Error checking existing username '%s': %v", body.Username, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to check username availability"})
		return
	}
	if err == nil {
		log.Printf("Username '%s' already taken when user %s (email: %s) attempted to update",
			body.Username, user.ID, utils.MaskEmail(user.Email))
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	// Update the username
	_, err = repo.ExecContext(c.Request.Context(), "UPDATE users SET username = ? WHERE id = ?", body.Username, user.ID)
	if err != nil {
		log.Printf("Error updating username for user %s (email: %s): %v",
			user.ID, utils.MaskEmail(user.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update username"})
		return
	}

	log.Printf("Successfully updated username for user %s (email: %s) to '%s'",
		user.ID, utils.MaskEmail(user.Email), body.Username)
	c.JSON(http.StatusOK, gin.H{"message": "Username updated successfully"})
}
