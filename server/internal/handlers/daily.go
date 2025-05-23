package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func HandleGetDaily(c *gin.Context) {
	repo := middleware.GetDB(c)
	now := time.Now()
	todayStr := utils.GetFormattedDate(now)
	userID := middleware.GetUserID(c)

	if repo == nil {
		log.Println("Database connection is nil")
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Database connection error"})
		return
	}

	alreadySubmittedToday, err := db.CheckHasSubmittedForDay(repo, c.Request.Context(), userID, todayStr)

	if err != nil {
		log.Printf("Error checking existing submission for user %s, day %s: %v", userID, todayStr, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error checking submission status"})
		return
	}

	prompt, err := db.GetDailyPromptFromDB(repo, c.Request.Context(), todayStr)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Printf("No daily prompt found for today")
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "There is no daily prompt for today."})
			return
		} else {
			// Other database error
			log.Printf("Error fetching daily prompt for %s from DB: %v", todayStr, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve daily prompt"})
			return
		}
	}

	response := db.DailyPromptWithCompletion{
		IsCompleted: alreadySubmittedToday,
		Day:         prompt.Day,
		Colors:      prompt.Colors,
		Prompt:      prompt.Prompt,
	}

	log.Printf("Already submitted? %t", alreadySubmittedToday)

	c.JSON(http.StatusOK, response)
}

type CanvasSubmission struct {
	CanvasData json.RawMessage `json:"canvasData" binding:"required"`
}

func HandlePostDaily(c *gin.Context) {
	userID := middleware.GetUserID(c)
	now := time.Now()
	todayStr := utils.GetFormattedDate(now)
	repo := middleware.GetDB(c)
	ctx := c.Request.Context()

	alreadySubmittedToday, err := db.CheckHasSubmittedForDay(repo, ctx, userID, todayStr)
	if err != nil {
		log.Printf("Error checking existing submission for user %s, day %s: %v", userID, todayStr, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error checking submission status"})
		return
	}

	if alreadySubmittedToday {
		log.Printf("Additional submit attempt for user %s, day %s", userID, todayStr)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "You have already submitted a drawing today"})
		return
	}

	var submission CanvasSubmission
	if err := c.ShouldBindJSON(&submission); err != nil {
		log.Printf("Error binding JSON for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid submission data"})
		return
	}

	// Validate that the canvas data is valid JSON
	var canvasData interface{}
	if err := json.Unmarshal(submission.CanvasData, &canvasData); err != nil {
		log.Printf("Invalid canvas data JSON from user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid canvas data format"})
		return
	}

	// Insert into the database
	insertSQL := `
        INSERT INTO user_submissions (id, user_id, day, canvas_data)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?)
    `
	_, err = repo.ExecContext(ctx, insertSQL, userID, todayStr, string(submission.CanvasData))
	if err != nil {
		log.Printf("Failed to insert submission record for user %s, day %s: %v", userID, todayStr, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error: Failed to record submission."})
		return
	}

	log.Printf("User %s successfully submitted drawing for %s", userID, todayStr)
	c.JSON(http.StatusCreated, gin.H{
		"message": "Drawing submitted successfully for today.",
		"day":     todayStr,
	})
}
