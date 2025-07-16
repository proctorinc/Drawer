package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/notifications"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleGetDaily(c *gin.Context) {
	repo := middleware.GetDB(c)
	now := time.Now()
	todayStr := utils.GetFormattedDate(now)
	userID := middleware.GetUserID(c)
	user := middleware.GetUser(c)

	alreadySubmittedToday, err := db.CheckHasSubmittedForDay(repo, c.Request.Context(), userID, todayStr)
	if err != nil {
		log.Printf("Error checking existing submission for user %s (email: %s), day %s: %v",
			userID, utils.MaskEmail(user.Email), todayStr, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error checking submission status"})
		return
	}

	prompt, err := db.GetDailyPromptFromDB(repo, c.Request.Context(), todayStr)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Printf("No daily prompt found for today (%s)", todayStr)
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "There is no daily prompt for today."})
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

	log.Printf("Retrieved daily prompt for user %s (email: %s) - Already submitted: %t",
		userID, utils.MaskEmail(user.Email), alreadySubmittedToday)

	c.JSON(http.StatusOK, response)
}

type CanvasSubmission struct {
	CanvasData json.RawMessage `json:"canvasData" binding:"required"`
}

func HandlePostDaily(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		log.Printf("Error: No user ID found in context")
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	user := middleware.GetUser(c)
	cfg := middleware.GetConfig(c)

	now := time.Now()
	todayStr := utils.GetFormattedDate(now)
	repo := middleware.GetDB(c)
	if repo == nil {
		log.Printf("Error: Database connection is nil for user %s", userID)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Database connection error"})
		return
	}

	ctx := c.Request.Context()
	storageService := middleware.GetStorageService(c)
	if storageService == nil {
		log.Printf("Error: Storage service is nil for user %s", userID)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Storage service error"})
		return
	}

	alreadySubmittedToday, err := db.CheckHasSubmittedForDay(repo, ctx, userID, todayStr)
	if err != nil {
		log.Printf("Error checking existing submission for user %s (email: %s), day %s: %v",
			userID, utils.MaskEmail(user.Email), todayStr, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error checking submission status"})
		return
	}

	if alreadySubmittedToday {
		log.Printf("Additional submit attempt for user %s (email: %s), day %s",
			userID, utils.MaskEmail(user.Email), todayStr)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "You have already submitted a drawing today"})
		return
	}

	// Get the PNG file from the request
	file, err := c.FormFile("image")
	if err != nil {
		log.Printf("Error getting image file for user %s (email: %s): %v",
			userID, utils.MaskEmail(user.Email), err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "No image file provided"})
		return
	}

	// Open the file
	f, err := file.Open()
	if err != nil {
		log.Printf("Error opening image file for user %s (email: %s): %v",
			userID, utils.MaskEmail(user.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Error processing image file"})
		return
	}
	defer f.Close()

	// Read the file into a buffer
	buf := make([]byte, file.Size)
	bytesRead, err := f.Read(buf)
	if err != nil {
		log.Printf("Error reading image file for user %s (email: %s): %v",
			userID, utils.MaskEmail(user.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Error reading image file"})
		return
	}
	if int64(bytesRead) != file.Size {
		log.Printf("Warning: Incomplete file read for user %s (email: %s). Expected %d bytes, got %d",
			userID, utils.MaskEmail(user.Email), file.Size, bytesRead)
	}

	// Insert into the database
	insertSQL := `
        INSERT INTO user_submissions (id, user_id, day, canvas_data)
        VALUES (?, ?, ?, ?)
        RETURNING id
    `
	var submissionID string
	err = repo.QueryRowContext(ctx, insertSQL, uuid.New().String(), userID, todayStr, string(buf)).Scan(&submissionID)
	if err != nil {
		log.Printf("Failed to insert submission record for user %s (email: %s), day %s: %v",
			userID, utils.MaskEmail(user.Email), todayStr, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error: Failed to record submission."})
		return
	}

	var imageURL string

	if cfg.Env != "development" {
		// Upload to S3
		url, err := storageService.UploadImage(userID, submissionID, buf)
		if err != nil {
			log.Printf("Error uploading image to S3 for user %s (email: %s): %v",
				userID, utils.MaskEmail(user.Email), err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Error uploading image"})
			return
		}

		imageURL = url
	} else {
		imageURL = "development.url"
	}

	log.Printf("User %s (email: %s) successfully submitted drawing for %s",
		userID, utils.MaskEmail(user.Email), todayStr)
	
	// Send notifications to friends (in background, don't block response)
	go func() {
		cfg := middleware.GetConfig(c)
		if err := notifications.NotifyFriendsOfSubmission(repo, userID, user.Username, submissionID, cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey); err != nil {
			log.Printf("Failed to send friend notifications for user %s: %v", userID, err)
		}
	}()
	
	c.JSON(http.StatusCreated, gin.H{
		"message":  "Drawing submitted successfully for today.",
		"day":      todayStr,
		"imageUrl": imageURL,
		"id":       submissionID,
	})
}

func HandleToggleFavoriteSubmission(c *gin.Context) {
	repo := middleware.GetDB(c)
	userID := middleware.GetUserID(c)
	submissionID := c.Param("id")
	if submissionID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Missing submission id"})
		return
	}
	added, err := db.ToggleFavoriteSubmission(repo, c.Request.Context(), userID, submissionID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"favorited": added})
}
