package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func HandleGetUser(c *gin.Context) {
	user := middleware.GetUser(c)
	repo := middleware.GetDB(c)

	response, err := db.GetUserDataFromDB(repo, c.Request.Context(), user.ID)
	if err != nil {
		log.Printf("Error querying user data for userId: %s (email: %s): %v", user.ID, utils.MaskEmail(user.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare user response"})
		return
	}

	c.JSON(http.StatusCreated, response)
}

func HandleAddFriend(c *gin.Context) {
	// Get the friend ID from the body of the request
	var body struct {
		FriendID string `json:"friendID"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Printf("Invalid add friend request body: %v", err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	friendID := body.FriendID
	if friendID == "" {
		log.Printf("Empty friend ID provided in request")
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Friend ID is required"})
		return
	}

	requester := middleware.GetUser(c)
	repo := middleware.GetDB(c)

	if requester.ID == friendID {
		log.Printf("User %s (email: %s) attempted to add themselves as a friend", requester.ID, utils.MaskEmail(requester.Email))
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "You cannot add yourself as a friend"})
		return
	}

	// Insert the friendship into the database
	insertSQL := `
		INSERT INTO friendships (user_id, friend_id) VALUES
			(?, ?),
			(?, ?),
		ON CONFLICT (user_id, friend_id) DO NOTHING
	`
	_, err := repo.ExecContext(c.Request.Context(), insertSQL, requester.ID, friendID, friendID, requester.ID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("Friend ID '%s' not found when user %s (email: %s) attempted to add them: %v",
				friendID, requester.ID, utils.MaskEmail(requester.Email), err)
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Friend not found"})
			return
		}
		log.Printf("Error adding friend ID '%s' for user %s (email: %s): %v",
			friendID, requester.ID, utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to add friend"})
		return
	}

	log.Printf("Successfully added friend ID '%s' for user %s (email: %s)",
		friendID, requester.ID, utils.MaskEmail(requester.Email))
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
