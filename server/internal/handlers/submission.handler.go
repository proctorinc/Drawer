package handlers

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/achievements"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/notifications"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func HandleGetSubmissionByID(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	submissionID := c.Param("id")
	if submissionID == "" {
		log.Printf("Empty submission ID provided in request")
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Submission ID is required"})
		return
	}

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
			u.avatar_type,
			u.avatar_url,
			us.created_at as submission_created_at
		FROM user_submissions us
		JOIN daily_prompts dp ON us.day = dp.day
		JOIN users u ON us.user_id = u.id
		WHERE us.id = ?
	`
	var (
		subID, day, colorsJSON, prompt, userID, username, email, userAvatarType, userAvatarURL string
		userCreatedAt, submissionCreatedAt                                                     sql.NullTime
	)
	err := appCtx.DB.QueryRowContext(c.Request.Context(), query, submissionID).Scan(
		&subID,
		&day,
		&colorsJSON,
		&prompt,
		&userID,
		&username,
		&email,
		&userCreatedAt,
		&userAvatarType,
		&userAvatarURL,
		&submissionCreatedAt,
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
		SELECT c.id, c.text, u.id, u.username, u.email, u.created_at, u.avatar_type, u.avatar_url, c.created_at
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.submission_id = ?
		ORDER BY c.created_at ASC`
	rows, err := appCtx.DB.QueryContext(c.Request.Context(), commentsQuery, submissionID)
	if err != nil {
		log.Printf("Error fetching comments for submission %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}
	defer rows.Close()
	comments := []models.Comment{}
	for rows.Next() {
		var commentID, commentText, commentUserID, commentUsername, commentUserEmail, commentUserAvatarType, commentUserAvatarURL string
		var commentUserCreatedAt, commentCreatedAt sql.NullTime
		err := rows.Scan(&commentID, &commentText, &commentUserID, &commentUsername, &commentUserEmail, &commentUserCreatedAt, &commentUserAvatarType, &commentUserAvatarURL, &commentCreatedAt)
		if err != nil {
			log.Printf("Error scanning comment row: %v", err)
			continue
		}
		comments = append(comments, models.Comment{
			ID: commentID,
			User: models.User{
				ID:         commentUserID,
				Username:   commentUsername,
				Email:      commentUserEmail,
				CreatedAt:  commentUserCreatedAt.Time,
				AvatarType: commentUserAvatarType,
				AvatarURL:  commentUserAvatarURL,
			},
			Text:      commentText,
			CreatedAt: commentCreatedAt.Time,
		})
	}

	imageUrl := utils.GetImageUrl(appCtx.Config, utils.GetSubmissionFilename(userID, subID))

	// Get reactions and counts for submission
	submissionReactions, err := queries.GetSubmissionReactions(appCtx.DB, c.Request.Context(), subID)
	if err != nil {
		log.Printf("Error fetching reactions for submission %s: %v", subID, err)
		// Continue without reactions rather than failing
		submissionReactions = []models.Reaction{}
	}

	submissionCounts, err := queries.GetSubmissionReactionCounts(appCtx.DB, c.Request.Context(), subID)
	if err != nil {
		log.Printf("Error fetching reaction counts for submission %s: %v", subID, err)
		// Continue without counts rather than failing
		submissionCounts = []models.ReactionCount{}
	}

	// Get reactions and counts for each comment
	for i := range comments {
		commentReactions, err := queries.GetCommentReactions(appCtx.DB, c.Request.Context(), comments[i].ID)
		if err != nil {
			log.Printf("Error fetching reactions for comment %s: %v", comments[i].ID, err)
			// Continue without reactions rather than failing
			commentReactions = []models.Reaction{}
		}
		comments[i].Reactions = commentReactions

		commentCounts, err := queries.GetCommentReactionCounts(appCtx.DB, c.Request.Context(), comments[i].ID)
		if err != nil {
			log.Printf("Error fetching reaction counts for comment %s: %v", comments[i].ID, err)
			// Continue without counts rather than failing
			commentCounts = []models.ReactionCount{}
		}
		comments[i].Counts = commentCounts
	}

	resp := models.UserPromptSubmission{
		ID:     subID,
		Day:    day,
		Colors: colors,
		Prompt: prompt,
		User: models.User{
			ID:         userID,
			Username:   username,
			Email:      email,
			CreatedAt:  userCreatedAt.Time,
			AvatarType: userAvatarType,
			AvatarURL:  userAvatarURL,
		},
		ImageUrl:  imageUrl,
		Comments:  comments,
		Reactions: submissionReactions,
		Counts:    submissionCounts,
		CreatedAt: submissionCreatedAt.Time,
	}

	// Set isFavorite if the requester is the owner and the submission is favorited
	if requester.ID == userID {
		var favID string
		err := appCtx.DB.QueryRowContext(c.Request.Context(), "SELECT id FROM user_favorite_submissions WHERE user_id = ? AND submission_id = ?", requester.ID, subID).Scan(&favID)
		if err == nil {
			resp.IsFavorite = true
		}
	}

	c.JSON(http.StatusOK, resp)
}

func HandleSubmissionToggleFavorite(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	userID := middleware.GetUserID(c)
	submissionID := c.Param("id")
	if submissionID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Missing submission id"})
		return
	}
	added, err := queries.ToggleFavoriteSubmission(appCtx.DB, c.Request.Context(), userID, submissionID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"favorited": added})
}

func HandleSubmissionToggleReaction(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

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
		"heart":     true,
		"cry-laugh": true,
		"face-meh":  true,
		"fire":      true,
	}
	if !validReactions[body.ReactionID] {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid reaction ID"})
		return
	}

	// Get submission owner for notification
	var submissionOwnerID string
	err := appCtx.DB.QueryRowContext(c.Request.Context(), "SELECT user_id FROM user_submissions WHERE id = ?", submissionID).Scan(&submissionOwnerID)
	if err != nil {
		log.Printf("Error getting submission owner for notification: %v", err)
		// Continue without notification rather than failing the reaction
	}

	// Toggle the reaction
	err = queries.ToggleReaction(appCtx.DB, c.Request.Context(), requester.ID, "submission", submissionID, body.ReactionID)
	if err != nil {
		log.Printf("Error toggling reaction for submission %s by user %s: %v", submissionID, requester.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle reaction"})
		return
	}

	// Get updated reactions and counts
	reactions, err := queries.GetSubmissionReactions(appCtx.DB, c.Request.Context(), submissionID)
	if err != nil {
		log.Printf("Error fetching reactions for submission %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reactions"})
		return
	}

	counts, err := queries.GetSubmissionReactionCounts(appCtx.DB, c.Request.Context(), submissionID)
	if err != nil {
		log.Printf("Error fetching reaction counts for submission %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reaction counts"})
		return
	}

	response := models.ReactionResponse{
		Reactions: reactions,
		Counts:    counts,
	}

	// Send notification to submission owner (in background)
	if submissionOwnerID != "" && submissionOwnerID != requester.ID {
		go func() {
			if err := notifications.NotifyUserOfReaction(appCtx.DB, requester.ID, requester.Username, submissionOwnerID, submissionID, body.ReactionID, "submission", appCtx.Config); err != nil {
				log.Printf("Failed to send reaction notification: %v", err)
			}
		}()
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

func HandleSwapFavoriteOrder(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	var req struct {
		ID1 string `json:"id1"`
		ID2 string `json:"id2"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if req.ID1 == "" || req.ID2 == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Both id1 and id2 are required"})
		return
	}
	err := queries.SwapFavoriteOrder(appCtx.DB, c.Request.Context(), requester.ID, req.ID1, req.ID2)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
