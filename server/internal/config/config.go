package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	DatabaseURL   string
	UploadDir     string
	AllowedOrigin string
	Env           string
}

func LoadConfig() *Config {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return &Config{
		Port:          getEnv("PORT", "8080"), // Default to 8080 if not set
		DatabaseURL:   getEnv("DATABASE_URL", "<no database url set>"),
		UploadDir:     getEnv("UPLOAD_DIR", "./uploads"),
		AllowedOrigin: getEnv("ALLOWED_ORIGINS", "http://localhost:1234"),
		Env:           getEnv("ENV", "development"),
	}
}

// Helper function to get environment variable with a default value
func getEnv(key string, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// Helper function to get a slice of environment variables
func getEnvSlice(key string, defaultValue []string) []string {
	if value, exists := os.LookupEnv(key); exists {
		return strings.Split(value, ",")
	}
	return defaultValue
}
