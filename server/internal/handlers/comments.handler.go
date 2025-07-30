package handlers

import (
	"context"
	"drawer-service-backend/internal/achievements"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/notifications"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func HandleAddCommentToSubmission(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

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

	// Get submission owner for notification
	var submissionOwnerID string
	err := appCtx.DB.QueryRowContext(c.Request.Context(), "SELECT user_id FROM user_submissions WHERE id = ?", submissionID).Scan(&submissionOwnerID)
	if err != nil {
		log.Printf("Error getting submission owner for notification: %v", err)
		// Continue without notification rather than failing the comment
	}

	insertSQL := `
		INSERT INTO comments (submission_id, user_id, text)
		VALUES (?, ?, ?)
		RETURNING id, created_at
	`
	var commentID int64
	var createdAt time.Time
	err = appCtx.DB.QueryRowContext(c.Request.Context(), insertSQL, submissionID, requester.ID, body.Text).Scan(&commentID, &createdAt)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to add comment"})
		return
	}

	resp := models.Comment{
		ID: fmt.Sprintf("%d", commentID),
		User: models.User{
			ID:        requester.ID,
			Username:  requester.Username,
			Email:     requester.Email,
			CreatedAt: requester.CreatedAt,
		},
		Text:      body.Text,
		CreatedAt: createdAt,
		Reactions: []models.Reaction{},
		Counts:    []models.ReactionCount{},
	}

	// Send notification to submission owner (in background)
	if submissionOwnerID != "" && submissionOwnerID != requester.ID {
		go func() {
			if err := notifications.NotifyUserOfComment(appCtx.DB, requester.ID, requester.Username, submissionOwnerID, submissionID, appCtx.Config); err != nil {
				log.Printf("Failed to send comment notification: %v", err)
			}
		}()
	}

	go func() {
		achievementService := achievements.NewAchievementService(appCtx.DB, context.Background(), requester.ID)
		err := achievementService.UpdateCommentAchievements(requester.ID)
		if err != nil {
			log.Printf("Error updating friend achievements for %s: %v", requester.ID, err)
		}
	}()

	c.JSON(http.StatusOK, resp)
}

func HandleCommentToggleReaction(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	commentID := c.Param("reactionId")
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
		"heart":     true,
		"cry-laugh": true,
		"face-meh":  true,
		"thumbs-up": true,
	}
	if !validReactions[body.ReactionID] {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid reaction ID"})
		return
	}

	// Toggle the reaction
	err := queries.ToggleReaction(appCtx.DB, c.Request.Context(), requester.ID, "comment", commentID, body.ReactionID)
	if err != nil {
		log.Printf("Error toggling reaction for comment %s by user %s: %v", commentID, requester.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle reaction"})
		return
	}

	// Get updated reactions and counts
	reactions, err := queries.GetCommentReactions(appCtx.DB, c.Request.Context(), commentID)
	if err != nil {
		log.Printf("Error fetching reactions for comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reactions"})
		return
	}

	counts, err := queries.GetCommentReactionCounts(appCtx.DB, c.Request.Context(), commentID)
	if err != nil {
		log.Printf("Error fetching reaction counts for comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reaction counts"})
		return
	}

	response := models.ReactionResponse{
		Reactions: reactions,
		Counts:    counts,
	}

	go func() {
		achievementService := achievements.NewAchievementService(appCtx.DB, context.Background(), requester.ID)
		err := achievementService.UpdateReactionAchievements(requester.ID)
		if err != nil {
			log.Printf("Error updating friend achievements for %s: %v", requester.ID, err)
		}
	}()

	c.JSON(http.StatusOK, response)
}
