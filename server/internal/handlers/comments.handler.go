package handlers

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/achievements"
	"drawer-service-backend/internal/ai"
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

	// Sent before responding: Cloud Run throttles CPU once the response is out, so a
	// push left in a goroutine waits for the next request to this instance.
	if submissionOwnerID != "" && submissionOwnerID != requester.ID {
		if err := notifications.NotifyUserOfComment(appCtx.DB, requester.ID, requester.Username, submissionOwnerID, submissionID, appCtx.Config); err != nil {
			log.Printf("Failed to send comment notification: %v", err)
		}
	}

	// The first comment to @mention the doodle's judge gets its answer right away; later
	// ones wait for an admin on the AI mentions page
	if reply, err := ai.StartMentionReply(c.Request.Context(), appCtx.DB, appCtx.Config, submissionID, requester.Username, body.Text); err != nil {
		log.Printf("AI judge: couldn't start answering comment %d: %v", commentID, err)
	} else if reply != nil {
		go reply.Run()
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

	if allowed, err := isReactionAllowed(c, body.ReactionID); err != nil {
		log.Printf("Error checking event reactions for %s: %v", body.ReactionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle reaction"})
		return
	} else if !allowed {
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

// HandleDeleteComment deletes a comment, and the reactions on it. Only the person who
// wrote the comment may delete it.
func HandleDeleteComment(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()

	submissionID := c.Param("id")
	commentID := c.Param("commentId")

	var authorID string
	err := appCtx.DB.QueryRowContext(ctx,
		"SELECT user_id FROM comments WHERE id = ? AND submission_id = ?", commentID, submissionID,
	).Scan(&authorID)
	if err == sql.ErrNoRows {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	} else if err != nil {
		log.Printf("Error looking up comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}
	if authorID != requester.ID {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You can only delete your own comments"})
		return
	}

	tx, err := appCtx.DB.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("Error starting transaction to delete comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}
	defer tx.Rollback()

	// Reactions point at comments by content_id with no foreign key, so clear them by hand
	if _, err := tx.ExecContext(ctx,
		"DELETE FROM reactions WHERE content_type = 'comment' AND content_id = ?", commentID,
	); err != nil {
		log.Printf("Error deleting reactions on comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}
	if _, err := tx.ExecContext(ctx,
		"DELETE FROM comments WHERE id = ? AND user_id = ?", commentID, requester.ID,
	); err != nil {
		log.Printf("Error deleting comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("Error committing delete of comment %s: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
