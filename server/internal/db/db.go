package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
)

func InitDB() (*sql.DB, error) {
	var db *sql.DB
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Provide a default DSN for local development if needed, but env var is better.
		// Example DSN: "postgres://user:password@host:port/dbname?sslmode=disable"
		log.Println("WARNING: DATABASE_URL environment variable not set. Using default local DSN.")
	}

	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Set connection pool parameters (adjust as needed)
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Verify the connection is working
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = db.PingContext(ctx)
	if err != nil {
		db.Close() // Close the pool if ping fails
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connection pool established successfully.")

	return db, nil
}

func InitializeSchema(db *sql.DB) error {
	schemaFile := "schema.sql" // Path to your schema file

	// Read the schema file
	schema, err := os.ReadFile(schemaFile)
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
