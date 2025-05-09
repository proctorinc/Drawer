package main

import (
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/routes"
	"errors"
	"log"
	"net/http"
	"os"
)

func main() {
	cfg := config.LoadConfig()
	repo, err := db.InitDB(cfg)

	if err != nil {
		log.Fatalf("CRITICAL: Database initialization failed: %v", err)
	}

	// if cfg.Env == "production" {
	// 	if err := db.InitializeSchema(repo); err != nil {
	// 		log.Fatalf("failed to initialize database schema: %v", err)
	// 	}
	// }

	// Defer closing the database connection pool on application exit
	defer func() {
		if err := repo.Close(); err != nil {
			log.Printf("Error closing database connection pool: %v", err)
		} else {
			log.Println("Database connection pool closed.")
		}
	}()

	// --- Upload Directory Check ---
	if err := os.MkdirAll(cfg.UploadDir, os.ModePerm); err != nil {
		log.Fatalf("CRITICAL: Failed to create base upload directory '%s': %v", cfg.UploadDir, err)
	}
	log.Printf("Upload directory set to: %s", cfg.UploadDir)

	if cfg.Env == "development" {
		log.Println("Running in development mode")
	} else {
		log.Println("Running in production mode")
	}

	// --- Gin Router Setup ---
	router := routes.InitRouter(cfg, repo)

	log.Printf("Server listening on port %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("Failed to run server: %v", err)
	}

	log.Println("Server stopped.")
}
