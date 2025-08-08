package handlers

import (
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/middleware"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func SuggestPrompt(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	userID := middleware.GetUserID(c)

	var body struct {
		Prompt string `json:"prompt" binding:"required"`
	}

	if err := c.ShouldBindJSON(&body); err != nil || body.Prompt == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Prompt text is required"})
		return
	}

	var suggestionsToday int
	checkQuery := `
        SELECT count(id)
        FROM prompt_suggestions
        WHERE user_id = $1 AND date(created_at) = date('now');
    `

	err := appCtx.DB.QueryRowContext(c.Request.Context(), checkQuery, userID).Scan(&suggestionsToday)

	if suggestionsToday >= 3 {
		log.Printf("User has reached suggestion limit for today")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "You can only make 3 suggestions per day"})
		return
	}

	query := `
        INSERT INTO prompt_suggestions (id, user_id, prompt)
        VALUES (?, ?, ?)
    `

	_, err = appCtx.DB.ExecContext(c.Request.Context(), query, uuid.New().String(), userID, body.Prompt)

	if err != nil {
		log.Printf("Failed to save suggestion %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit suggestion"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Successfully submitted prompt suggestion"})
}

func GetAllPromptSuggestions(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)

	query := `
        SELECT p.id, p.prompt, p.created_at, u.id, u.username, u.email, u.role, u.created_at, u.avatar_type, u.avatar_url
        FROM prompt_suggestions p
        LEFT JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC
    `

	suggestions := []models.PromptSuggestion{}
	rows, err := appCtx.DB.QueryContext(c.Request.Context(), query)

	if err != nil {
		log.Printf("Error fetching prompt suggestions: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch prompt suggestions"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var (
			suggestionID        string
			suggestionPrompt    string
			suggestionCreatedAt time.Time
			userID              sql.NullString
			username            sql.NullString
			email               sql.NullString
			role                sql.NullString
			userCreatedAt       sql.NullTime
			avatarType          sql.NullString
			avatarURL           sql.NullString
		)

		err := rows.Scan(&suggestionID, &suggestionPrompt, &suggestionCreatedAt,
			&userID, &username, &email, &role, &userCreatedAt, &avatarType, &avatarURL)
		if err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		suggestion := models.PromptSuggestion{
			ID:        suggestionID,
			Prompt:    suggestionPrompt,
			CreatedAt: suggestionCreatedAt,
		}

		if userID.Valid {
			suggestion.CreatedBy = models.User{
				ID:         userID.String,
				Username:   username.String,
				Email:      email.String,
				Role:       role.String,
				CreatedAt:  userCreatedAt.Time,
				AvatarType: avatarType.String,
				AvatarURL:  avatarURL.String,
			}
		}

		suggestions = append(suggestions, suggestion)
	}

	c.JSON(http.StatusCreated, suggestions)
}
