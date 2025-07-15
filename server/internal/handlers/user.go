package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func HandleGetUser(c *gin.Context) {
	user := middleware.GetUser(c)
	repo := middleware.GetDB(c)

	response, err := db.GetUserByID(repo, c.Request.Context(), user.ID)
	if err != nil {
		log.Printf("Error querying user data for userId: %s (email: %s): %v", user.ID, utils.MaskEmail(user.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare user response"})
		return
	}

	c.JSON(http.StatusCreated, response)
}

func HandleGetUserProfile(c *gin.Context) {
	user := middleware.GetUser(c)
	repo := middleware.GetDB(c)
	cfg := middleware.GetConfig(c)

	response, err := db.GetUserProfileFromDB(repo, c.Request.Context(), user.ID, cfg)
	if err != nil {
		log.Printf("Error querying user profile data for userId: %s (email: %s): %v", user.ID, utils.MaskEmail(user.Email), err)
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
	cfg := middleware.GetConfig(c)

	// Query the user from the database
	user, err := db.GetUserProfileFromDB(repo, c.Request.Context(), userID, cfg)

	if err != nil {
		log.Printf("Error retrieving user (ID: %s): %v",
			userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to add friend"})
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

func HandleGetPromptSubmissionByID(c *gin.Context) {
	submissionID := c.Param("id")
	if submissionID == "" {
		log.Printf("Empty submission ID provided in request")
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Submission ID is required"})
		return
	}

	repo := middleware.GetDB(c)
	cfg := middleware.GetConfig(c)

	// Query the submission, its user, and prompt info
	query := `
		SELECT
			us.id,
			us.day,
			dp.colors,
			dp.prompt,
			u.id as user_id,
			u.username,
			u.email,
			u.created_at,
			us.created_at as submission_created_at,
			us.canvas_data
		FROM user_submissions us
		JOIN daily_prompts dp ON us.day = dp.day
		JOIN users u ON us.user_id = u.id
		WHERE us.id = ?
	`
	var (
		subID, day, colorsJSON, prompt, userID, username, email, canvasData string
		userCreatedAt, submissionCreatedAt sql.NullTime
	)
	err := repo.QueryRowContext(c.Request.Context(), query, submissionID).Scan(
		&subID,
		&day,
		&colorsJSON,
		&prompt,
		&userID,
		&username,
		&email,
		&userCreatedAt,
		&submissionCreatedAt,
		&canvasData,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
			return
		}
		log.Printf("Error fetching submission by id %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submission"})
		return
	}

	// Parse colors
	var colors []string
	_ = json.Unmarshal([]byte(colorsJSON), &colors)

	// Query comments for this submission
	commentsQuery := `
		SELECT c.id, c.text, u.id, u.username, u.email, u.created_at, c.created_at
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.submission_id = ?
		ORDER BY c.created_at DESC`
	rows, err := repo.QueryContext(c.Request.Context(), commentsQuery, submissionID)
	if err != nil {
		log.Printf("Error fetching comments for submission %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}
	defer rows.Close()
	comments := []db.Comment{}
	for rows.Next() {
		var commentID, commentText, commentUserID, commentUsername, commentUserEmail string
		var commentUserCreatedAt, commentCreatedAt sql.NullTime
		err := rows.Scan(&commentID, &commentText, &commentUserID, &commentUsername, &commentUserEmail, &commentUserCreatedAt, &commentCreatedAt)
		if err != nil {
			log.Printf("Error scanning comment row: %v", err)
			continue
		}
		comments = append(comments, db.Comment{
			ID: commentID,
			User: db.User{
				ID:        commentUserID,
				Username:  commentUsername,
				Email:     commentUserEmail,
				CreatedAt: commentUserCreatedAt.Time,
			},
			Text: commentText,
			CreatedAt: commentCreatedAt.Time,
		})
	}

	imageUrl := utils.GetImageUrl(cfg, utils.GetImageFilename(userID, subID))

	// Get reactions and counts for submission
	submissionReactions, err := db.GetReactionsForSubmission(repo, c.Request.Context(), subID)
	if err != nil {
		log.Printf("Error fetching reactions for submission %s: %v", subID, err)
		// Continue without reactions rather than failing
		submissionReactions = []db.Reaction{}
	}

	submissionCounts, err := db.GetReactionCountsForSubmission(repo, c.Request.Context(), subID)
	if err != nil {
		log.Printf("Error fetching reaction counts for submission %s: %v", subID, err)
		// Continue without counts rather than failing
		submissionCounts = []db.ReactionCount{}
	}

	// Get reactions and counts for each comment
	for i := range comments {
		commentReactions, err := db.GetReactionsForComment(repo, c.Request.Context(), comments[i].ID)
		if err != nil {
			log.Printf("Error fetching reactions for comment %s: %v", comments[i].ID, err)
			// Continue without reactions rather than failing
			commentReactions = []db.Reaction{}
		}
		comments[i].Reactions = commentReactions

		commentCounts, err := db.GetReactionCountsForComment(repo, c.Request.Context(), comments[i].ID)
		if err != nil {
			log.Printf("Error fetching reaction counts for comment %s: %v", comments[i].ID, err)
			// Continue without counts rather than failing
			commentCounts = []db.ReactionCount{}
		}
		comments[i].Counts = commentCounts
	}

	resp := db.UserPromptSubmission{
		ID:       subID,
		Day:      day,
		Colors:   colors,
		Prompt:   prompt,
		User: db.User{
			ID:        userID,
			Username:  username,
			Email:     email,
			CreatedAt: userCreatedAt.Time,
		},
		ImageUrl:  imageUrl,
		Comments:  comments,
		Reactions: submissionReactions,
		Counts:    submissionCounts,
	}

	c.JSON(http.StatusOK, resp)
}

func HandleAddCommentToSubmission(c *gin.Context) {
	submissionID := c.Param("id")
	if submissionID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Submission ID is required"})
		return
	}

	var body struct {
		Text string `json:"text" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Text == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Text is required"})
		return
	}

	repo := middleware.GetDB(c)
	user := middleware.GetUser(c)

	insertSQL := `
		INSERT INTO comments (submission_id, user_id, text)
		VALUES (?, ?, ?)
		RETURNING id, created_at
	`
	var commentID int64
	var createdAt time.Time
	err := repo.QueryRowContext(c.Request.Context(), insertSQL, submissionID, user.ID, body.Text).Scan(&commentID, &createdAt)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to add comment"})
		return
	}

	resp := db.Comment{
		ID: fmt.Sprintf("%d", commentID),
		User: db.User{
			ID:        user.ID,
			Username:  user.Username,
			Email:     user.Email,
			CreatedAt: user.CreatedAt,
		},
		Text:      body.Text,
		CreatedAt: createdAt,
		Reactions: []db.Reaction{},
		Counts:    []db.ReactionCount{},
	}

	c.JSON(http.StatusOK, resp)
}

func HandleToggleSubmissionReaction(c *gin.Context) {
	submissionID := c.Param("id")
	if submissionID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Submission ID is required"})
		return
	}

	var body struct {
		ReactionID string `json:"reactionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.ReactionID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Reaction ID is required"})
		return
	}

	// Validate reaction ID
	validReactions := map[string]bool{
		"heart":      true,
		"cry-laugh":  true,
		"face-meh":   true,
		"fire":  true,
	}
	if !validReactions[body.ReactionID] {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid reaction ID"})
		return
	}

	repo := middleware.GetDB(c)
	user := middleware.GetUser(c)

	// Toggle the reaction
	err := db.ToggleReaction(repo, c.Request.Context(), user.ID, "submission", submissionID, body.ReactionID)
	if err != nil {
		log.Printf("Error toggling reaction for submission %s by user %s: %v", submissionID, user.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle reaction"})
		return
	}

	// Get updated reactions and counts
	reactions, err := db.GetReactionsForSubmission(repo, c.Request.Context(), submissionID)
	if err != nil {
		log.Printf("Error fetching reactions for submission %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reactions"})
		return
	}

	counts, err := db.GetReactionCountsForSubmission(repo, c.Request.Context(), submissionID)
	if err != nil {
		log.Printf("Error fetching reaction counts for submission %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reaction counts"})
		return
	}

	response := db.ReactionResponse{
		Reactions: reactions,
		Counts:    counts,
	}

	c.JSON(http.StatusOK, response)
}

func HandleToggleCommentReaction(c *gin.Context) {
	commentID := c.Param("id")
	if commentID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Comment ID is required"})
		return
	}

	var body struct {
		ReactionID string `json:"reactionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.ReactionID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Reaction ID is required"})
		return
	}

	// Validate reaction ID
	validReactions := map[string]bool{
		"heart":      true,
		"cry-laugh":  true,
		"face-meh":   true,
		"thumbs-up":  true,
	}
	if !validReactions[body.ReactionID] {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid reaction ID"})
		return
	}

	repo := middleware.GetDB(c)
	user := middleware.GetUser(c)

	// Toggle the reaction
	err := db.ToggleReaction(repo, c.Request.Context(), user.ID, "comment", commentID, body.ReactionID)
	if err != nil {
		log.Printf("Error toggling reaction for comment %s by user %s: %v", commentID, user.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle reaction"})
		return
	}

	// Get updated reactions and counts
	reactions, err := db.GetReactionsForComment(repo, c.Request.Context(), commentID)
	if err != nil {
		log.Printf("Error fetching reactions for comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reactions"})
		return
	}

	counts, err := db.GetReactionCountsForComment(repo, c.Request.Context(), commentID)
	if err != nil {
		log.Printf("Error fetching reaction counts for comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reaction counts"})
		return
	}

	response := db.ReactionResponse{
		Reactions: reactions,
		Counts:    counts,
	}

	c.JSON(http.StatusOK, response)
}
