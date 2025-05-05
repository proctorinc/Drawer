package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"
	"log"
	"net/http"
	"time"

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

func HandleCreateUser(c *gin.Context) {
	var body struct {
		Name  string `json:"name" binding:"required"`
		Email string `json:"email" binding:"required,email"`
	}

	// Bind the JSON body to the struct
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Create the user in the database
	repo := middleware.GetDB(c)
	ctx := c.Request.Context()

	userID, err := db.CreateUser(repo, ctx, body.Name, body.Email)
	if err != nil {
		log.Printf("Error creating user: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Set the user ID as an HTTP-only cookie
	c.SetCookie("user_id", userID, 0, "/", "", true, true)

	// Fetch the user object
	user, err := db.GetUserByID(repo, ctx, userID) // Implement this function to get user by ID
	if err != nil {
		log.Printf("Error fetching user by ID %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
		return
	}

	// Prepare the response
	response, err := prepareUserResponse(c, user)
	if err != nil {
		log.Printf("Error preparing user response: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare user response"})
		return
	}

	c.JSON(http.StatusCreated, response)
}

func HandleLoginUser(c *gin.Context) {
	var body struct {
		Email string `json:"email" binding:"required,email"`
	}

	// Bind the JSON body to the struct
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get the database connection
	repo := middleware.GetDB(c)
	ctx := c.Request.Context()

	// Find the user by email
	user, err := db.GetUserByEmail(repo, ctx, body.Email) // Implement this function in your db package
	if err != nil {
		log.Printf("Error finding user by email %s: %v", body.Email, err)
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	cookie := &http.Cookie{
		Name:     "user_id",
		Value:    user.ID,
		Expires:  time.Now().Add(8760 * time.Hour), // 1 year
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	}

	http.SetCookie(c.Writer, cookie)

	// Prepare the response
	response, err := prepareUserResponse(c, user)
	if err != nil {
		log.Printf("Error preparing user response: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare user response"})
		return
	}

	c.JSON(http.StatusOK, response)
}

func HandleLogoutUser(c *gin.Context) {
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
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}
