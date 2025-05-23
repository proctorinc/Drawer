package db

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func InitDB(cfg *config.Config) (*sql.DB, error) {
	// For local development, use a local SQLite file
	// For production, use Turso
	var dbURL string
	if cfg.Env == "production" {
		dbURL = cfg.DatabaseURL // This should be your Turso database URL
	} else {
		dbURL = "file:drawer.db?cache=shared&_journal=WAL&_timeout=5000"
	}

	db, err := sql.Open("libsql", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	if cfg.Env == "production" {
		// Turso can handle concurrent connections
		db.SetMaxOpenConns(25)                 // Allow more concurrent connections
		db.SetMaxIdleConns(10)                 // Keep more idle connections
		db.SetConnMaxLifetime(5 * time.Minute) // Shorter lifetime for connections
		db.SetConnMaxIdleTime(1 * time.Minute) // Shorter idle time
	} else {
		// Local SQLite settings
		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)
		db.SetConnMaxLifetime(time.Hour)
	}

	// Verify the connection is working
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = db.PingContext(ctx)
	if err != nil {
		db.Close() // Close the pool if ping fails
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connection established successfully.")

	return db, nil
}

func InitializeSchema(db *sql.DB) error {
	schema, err := os.ReadFile("schema.sql")
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}

	// Execute the schema SQL commands
	_, err = db.Exec(string(schema))
	if err != nil {
		return fmt.Errorf("failed to execute schema SQL: %w", err)
	}

	log.Println("Database schema initialized successfully.")
	return nil
}
