package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func HandleGetUser(c *gin.Context) {
	user := middleware.GetUser(c)

	response, err := prepareUserResponse(c, &user)
	if err != nil {
		log.Printf("Error preparing user response for user %s (email: %s): %v", user.ID, utils.MaskEmail(user.Email), err)
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
