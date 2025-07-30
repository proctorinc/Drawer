package utils // getFormattedDate returns the current date string in YYYY-MM-DD format.
import (
	"drawer-service-backend/internal/config"
	"fmt"
	"mime/multipart"
	"strings"
	"time"
)

const DateFormat = "2006-01-02"

func GetFormattedDate(t time.Time) string {
	return t.Format(DateFormat)
}

// MaskEmail masks an email address for logging purposes.
// Example: "user@example.com" becomes "u***@example.com"
func MaskEmail(email string) string {
	if email == "" {
		return ""
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "***@***"
	}
	username := parts[0]
	domain := parts[1]
	if len(username) <= 1 {
		return "***@" + domain
	}
	return username[:3] + "***@" + domain
}

func GetImageUrl(cfg *config.Config, imageFilename string) string {
	if cfg.Env == "production" {
		return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", cfg.S3BucketName, cfg.S3BucketRegion, imageFilename)
	}

	return "/example.png"
}

func GetSubmissionFilename(userId string, submissionId string) string {
	return fmt.Sprintf("%s/%s.png", userId, submissionId)
}

func GetProfilePictureFilename(userId string) string {
	return fmt.Sprintf("%s/profile.png", userId)
}

func ReadFileToBuffer(file *multipart.FileHeader) ([]byte, error) {
	// Open the file
	f, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("Unable to open file: %v", err)
	}
	defer f.Close()

	// Read the file into a buffer
	buf := make([]byte, file.Size)
	bytesRead, err := f.Read(buf)
	if err != nil {
		return nil, fmt.Errorf("Unable to read file: %v", err)
	}

	if int64(bytesRead) != file.Size {
		return nil, fmt.Errorf("Incomplete file read. Expected %d bytes, got %d", file.Size, bytesRead)
	}

	return buf, nil
}
