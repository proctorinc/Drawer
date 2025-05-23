package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/middleware"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func HandleGetUser(c *gin.Context) {
	user := middleware.GetUser(c)

	response, err := prepareUserResponse(c, &user)
	if err != nil {
		log.Printf("Error preparing user response: %v", err)
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
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	friendID := body.FriendID
	if friendID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Friend ID is required"})
		return
	}

	requester := middleware.GetUser(c)
	repo := middleware.GetDB(c)

	if requester.ID == friendID {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "You cannot add yourself as a friend"})
		return
	}

	// Insert the friendship into the database
	insertSQL := `
		INSERT INTO friendships (user_id, friend_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, friend_id) DO NOTHING
	`
	_, err := repo.ExecContext(c.Request.Context(), insertSQL, requester.ID, friendID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("Friend ID '%s' not found: %v", friendID, err)
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Friend not found"})
			return
		}
		log.Printf("Error adding friend: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to add friend"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend added successfully"})
}
