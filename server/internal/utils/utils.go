package utils // getFormattedDate returns the current date string in YYYY-MM-DD format.
import (
	"drawer-service-backend/internal/config"
	"fmt"
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

func GetImageFilename(userId string, submissionId string) string {
	return fmt.Sprintf("%s/%s.png", userId, submissionId)
}
