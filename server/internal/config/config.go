package config

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	AllowedOrigin   string
	Env             string
	ClerkSecretKey  string
	DevUserEmail    string
	EventsFakeNow   string // Non-production only: pretend "now" is this date for events
	EventsNotify    bool   // Also send event push broadcasts outside production (always on in production)
	S3BucketName    string
	S3BucketRegion  string
	AwsAccessKey    string
	AwsSecretKey    string
	VAPIDPrivateKey string
	VAPIDPublicKey  string
	VAPIDSubject    string
	// Fallback OpenAI key for the AI judges, used when none is saved in the admin screen
	OpenAIAPIKey string
	// Optional: another OpenAI-compatible endpoint (a proxy or gateway), e.g. https://example.com/v1
	OpenAIBaseURL string
}

func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	env := getEnv("ENV", "production")
	var dbURL string
	if env == "production" {
		// For production, use Turso
		tursoURL := getEnv("TURSO_DATABASE_URL", "<turso db url>")
		tursoToken := getEnv("TURSO_AUTH_TOKEN", "<turso auth token>")

		if tursoURL == "" || tursoToken == "" {
			log.Fatal("Both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required in production")
		}

		// Format the URL with the auth token
		dbURL = fmt.Sprintf("%s?authToken=%s", tursoURL, tursoToken)
	} else {
		// For development, use local SQLite
		dbURL = "file:drawer.db?cache=shared&_journal=WAL&_timeout=5000"
	}

	clerkSecretKey := getEnv("CLERK_SECRET_KEY", "")
	if clerkSecretKey == "" {
		log.Fatal("CLERK_SECRET_KEY is required")
	}

	allowedOrigin := getEnv("ALLOWED_ORIGINS", "http://localhost:3000")

	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     dbURL,
		AllowedOrigin:   allowedOrigin,
		Env:             env,
		ClerkSecretKey:  clerkSecretKey,
		DevUserEmail:    getEnv("DEV_USER_EMAIL", ""),
		EventsFakeNow:   getEnv("EVENTS_FAKE_NOW", ""),
		EventsNotify:    getEnv("EVENT_NOTIFICATIONS_ENABLED", "") == "true",
		S3BucketName:    getEnv("S3_BUCKET_NAME", ""),
		S3BucketRegion:  getEnv("S3_BUCKET_REGION", ""),
		AwsAccessKey:    getEnv("AWS_ACCESS_KEY_ID", ""),
		AwsSecretKey:    getEnv("AWS_SECRET_ACCESS_KEY", ""),
		VAPIDPrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
		VAPIDPublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
		// Contact for push services: an https URL or an email address. webpush-go
		// adds "mailto:" to anything that isn't https, and Apple rejects an empty one.
		VAPIDSubject:  strings.TrimPrefix(getEnv("VAPID_SUBJECT", allowedOrigin), "mailto:"),
		OpenAIAPIKey:  getEnv("OPENAI_API_KEY", ""),
		OpenAIBaseURL: getEnv("OPENAI_BASE_URL", ""),
	}
}

// Helper function to get environment variable with a default value
func getEnv(key string, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
