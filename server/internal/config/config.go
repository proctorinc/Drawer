package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	AllowedOrigin   string
	Env             string
	FromEmail       string
	BaseURL         string
	ResendAPIKey    string
	S3BucketName    string
	S3BucketRegion  string
	AwsAccessKey    string
	AwsSecretKey    string
	VAPIDPrivateKey string
	VAPIDPublicKey  string
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

	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     dbURL,
		AllowedOrigin:   getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
		Env:             env,
		FromEmail:       getEnv("FROM_EMAIL", "your.email@gmail.com"),
		BaseURL:         getEnv("BASE_URL", "http://localhost:3000"),
		ResendAPIKey:    getEnv("RESEND_API_KEY", ""),
		S3BucketName:    getEnv("S3_BUCKET_NAME", ""),
		S3BucketRegion:  getEnv("S3_BUCKET_REGION", ""),
		AwsAccessKey:    getEnv("AWS_ACCESS_KEY_ID", ""),
		AwsSecretKey:    getEnv("AWS_SECRET_ACCESS_KEY", ""),
		VAPIDPrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
		VAPIDPublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
	}
}

// Helper function to get environment variable with a default value
func getEnv(key string, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
