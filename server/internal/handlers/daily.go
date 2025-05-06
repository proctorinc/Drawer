package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

func HandleGetDaily(c *gin.Context) {
	repo := middleware.GetDB(c)
	now := time.Now()
	todayStr := utils.GetFormattedDate(now)
	userID := middleware.GetUserID(c)

	// --- 1. Check if the user has already submitted for today in the DB ---
	checkQuery := `SELECT EXISTS(SELECT 1 FROM user_submissions WHERE user_id = $1 AND day = $2)`
	var alreadySubmittedToday bool
	err := repo.QueryRowContext(c, checkQuery, userID, todayStr).Scan(&alreadySubmittedToday)
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

func HandlePostDaily(c *gin.Context) {
	userID := middleware.GetUserID(c)
	now := time.Now()
	todayStr := utils.GetFormattedDate(now)
	repo := middleware.GetDB(c)
	config := middleware.GetConfig(c)
	ctx := c.Request.Context() // Use request context for DB operations

	// --- 1. Check if the user has already submitted for today in the DB ---
	checkQuery := `SELECT EXISTS(SELECT 1 FROM user_submissions WHERE user_id = $1 AND day = $2)`
	var alreadySubmittedToday bool
	err := repo.QueryRowContext(ctx, checkQuery, userID, todayStr).Scan(&alreadySubmittedToday)
	if err != nil {
		log.Printf("Error checking existing submission for user %s, day %s: %v", userID, todayStr, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error checking submission status"})
		return
	}

	if alreadySubmittedToday {
		log.Printf("Submission rejected: User %s already submitted for %s", userID, todayStr)
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("You have already submitted an image for today (%s)", todayStr)})
		return
	}

	// --- 2. Get the uploaded file from the form data ---
	fileHeader, err := c.FormFile("image")
	if err != nil {
		log.Printf("Error getting form file 'image': %v", err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Image file upload failed. Ensure the form field name is 'image'."})
		return
	}

	// --- 3. Validate file type (ensure it's PNG) ---
	if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".png") {
		log.Printf("Invalid file type uploaded by %s: %s", userID, fileHeader.Filename)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Only PNG files (.png) are allowed."})
		return
	}

	// --- 4. Prepare the save path and filename ---
	userUploadDir := filepath.Join(config.UploadDir, userID)
	if err := os.MkdirAll(userUploadDir, os.ModePerm); err != nil {
		log.Printf("CRITICAL: Error creating upload directory '%s': %v", userUploadDir, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error: Could not create storage directory."})
		return
	}
	filename := fmt.Sprintf("%s.png", todayStr) // Use date as filename
	filePath := filepath.Join(userUploadDir, filename)
	imageURL := fmt.Sprintf("/uploads/%s/%s", userID, filename) // Relative URL path

	// --- 5. Save the uploaded file to disk ---
	srcFile, err := fileHeader.Open()
	if err != nil {
		log.Printf("Error opening uploaded file header for user %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error: Could not process uploaded file."})
		return
	}
	defer func(srcFile multipart.File) { _ = srcFile.Close() }(srcFile)

	dstFile, err := os.Create(filePath)
	if err != nil {
		log.Printf("CRITICAL: Error creating destination file '%s': %v", filePath, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error: Could not save file."})
		return
	}
	defer func(dstFile *os.File) { _ = dstFile.Close() }(dstFile)

	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		log.Printf("CRITICAL: Error copying file content to '%s': %v", filePath, err)
		_ = os.Remove(filePath) // Attempt cleanup
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error: Failed to write file content."})
		return
	}

	// --- 6. Record the successful submission in the database ---
	insertSQL := `
        INSERT INTO user_submissions (user_id, day, file_path)
        VALUES ($1, $2, $3)
    `
	_, err = repo.ExecContext(ctx, insertSQL, userID, todayStr, imageURL) // Store the URL/relative path
	if err != nil {
		// Handle potential unique constraint violation (e.g., race condition)
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			log.Printf("Submission race condition for user %s, day %s. Already submitted.", userID, todayStr)
			_ = os.Remove(filePath) // Clean up the newly saved file as the DB record failed
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("You have already submitted an image for today (%s) (race condition detected)", todayStr)})
			return
		}
		// Other DB error
		log.Printf("CRITICAL: Failed to insert submission record for user %s, day %s: %v", userID, todayStr, err)
		_ = os.Remove(filePath) // Clean up the saved file if DB insert fails
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error: Failed to record submission."})
		return
	}

	log.Printf("User %s successfully uploaded image for %s to %s and recorded in DB", userID, todayStr, filePath)
	// Return a success response.
	c.JSON(http.StatusCreated, gin.H{
		"message":  "File uploaded successfully for today.",
		"imageURL": imageURL,
		"day":      todayStr,
	})
}
