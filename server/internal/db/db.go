package db

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func InitDB(cfg *config.Config) (*sql.DB, error) {
	// For local development, use a local SQLite file
	// For production, use Turso
	var db *sql.DB
	var err error

	if cfg.Env == "production" {
		res, err := initProductionDB(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to open database connection: %w", err)
		}

		db = res
	} else {
		res, err := initLocalDB()
		if err != nil {
			return nil, fmt.Errorf("failed to open database connection: %w", err)
		}

		err = initializeDevData(res)

		if err != nil {
			return nil, fmt.Errorf("failed to initialize dev data: %w", err)
		}

		log.Println("Initialized dev database")

		db = res
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

func initProductionDB(cfg *config.Config) (*sql.DB, error) {
	db, err := sql.Open("libsql", cfg.DatabaseURL)

	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	db.SetMaxOpenConns(25)                 // Allow more concurrent connections
	db.SetMaxIdleConns(10)                 // Keep more idle connections
	db.SetConnMaxLifetime(5 * time.Minute) // Shorter lifetime for connections
	db.SetConnMaxIdleTime(1 * time.Minute) // Shorter idle time

	return db, nil
}

func initLocalDB() (*sql.DB, error) {
	db, err := sql.Open("sqlite3", "file:drawer.db?cache=shared&_journal=WAL&_timeout=5000")

	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(time.Hour)

	return db, nil
}

func initializeDevData(db *sql.DB) error {
	log.Println("Initializing dev data")
	schema, err := os.ReadFile("schema.sql")
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}

	// Execute the schema SQL commands
	_, err = db.Exec(string(schema))
	if err != nil {
		return fmt.Errorf("failed to execute schema SQL: %w", err)
	}

	migrationsSchema, err := os.ReadFile("./migrations/schema.sql")
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}

	// Execute the schema SQL commands
	_, err = db.Exec(string(migrationsSchema))
	if err != nil {
		return fmt.Errorf("failed to execute schema SQL: %w", err)
	}

	log.Println("Database schema initialized successfully.")

	// Add demo data
	demoData := `
		-- Insert demo users
		INSERT OR IGNORE INTO users (id, username, email, created_at) VALUES 
			('user1', 'tankard_wellington', 'demo1@example.com', date('now', '-63 days')),
			('user2', 'wifey_p', 'demo2@example.com', date('now', '-13 days')),
			('user3', 'matty_p', 'demo3@example.com', date('now', '-13 days')),
			('user4', 'jimbo', 'demo4@example.com', date('now', '-13 days')),
			('user5', 'jonny_p', 'demo5@example.com', date('now', '-13 days')),
			('user6', 'ubebae', 'demo6@example.com', date('now', '-13 days')),
			('user7', 'bufy', 'demo7@example.com', date('now', '-13 days')),
			('user8', 'pro_tractor', 'demo8@example.com', date('now', '-13 days'));

		-- Make them friends
		INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES 
			('user1', 'user2'),
			('user2', 'user1'),
			('user1', 'user3'),
			('user3', 'user1'),
			('user1', 'user4'),
			('user4', 'user1'),
			('user1', 'user5'),
			('user5', 'user1'),
			('user1', 'user6'),
			('user6', 'user1'),
			('user1', 'user7'),
			('user7', 'user1');;

		INSERT OR IGNORE INTO daily_prompts (day, colors, prompt) VALUES 
			(date('now', '-13 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A sunset over mountains'),
			(date('now', '-8 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A test thing'),
			(date('now', '-7 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A cool forest'),
			(date('now', '-6 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A banana'),
			(date('now', '-5 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A curved yellow fruit'),
			(date('now', '-4 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A peanut butter sandwich'),
			(date('now', '-3 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A goalie'),
			(date('now', '-2 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A futbol americano'),
			(date('now', '-1 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A prank'),
			(date('now'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A prehistoric city'),
			(date('now', '+1 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A tangerine'),
			(date('now', '+2 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'An orange banana');

		INSERT OR IGNORE INTO user_submissions (id, user_id, day, canvas_data) VALUES 
			('sub00', 'user1', date('now', '-60 days'), ''),	
			('sub0', 'user1', date('now', '-30 days'), ''),	
			('sub1', 'user1', date('now', '-6 days'), ''),
			('sub2', 'user1', date('now', '-4 days'), ''),
			('sub3', 'user1', date('now', '-3 days'), ''),
			('sub4', 'user1', date('now', '-2 days'), ''),
			('sub5', 'user2', date('now', '-6 days'), ''),
			('sub6', 'user2', date('now', '-4 days'), ''),
			('sub7', 'user2', date('now', '-3 days'), ''),
			('sub8', 'user2', date('now', '-2 days'), ''),
			('sub9', 'user1', date('now', '-1 days'), ''),
			('sub10', 'user1', date('now'), '');

		INSERT INTO comments (submission_id, user_id, text, created_at) VALUES
			('sub1', 'user2', 'Nice drawing!', date('now', '-6 days')),
			('sub1', 'user3', 'Love the colors!', date('now', '-6 days')),
			('sub2', 'user1', 'This is my own work.', date('now', '-4 days')),
			('sub2', 'user2', 'Great job!', date('now', '-4 days')),
			('sub3', 'user3', 'Amazing!', date('now', '-3 days')),
			('sub3', 'user1', 'Thank you!', date('now', '-3 days')),
			('sub4', 'user2', 'So creative!', date('now', '-2 days')),
			('sub4', 'user3', 'Wow!', date('now', '-2 days'));

		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('user2', 'submission', 'sub1', 'fire', date('now', '-6 days')),
			('user3', 'submission', 'sub1', 'heart', date('now', '-6 days')),
			('user1', 'submission', 'sub2', 'fire', date('now', '-4 days')),
			('user2', 'submission', 'sub2', 'cry-laugh', date('now', '-4 days')),
			('user3', 'submission', 'sub3', 'face-meh', date('now', '-3 days')),
			('user1', 'submission', 'sub3', 'fire', date('now', '-3 days')),
			('user2', 'submission', 'sub4', 'fire', date('now', '-2 days')),
			('user3', 'submission', 'sub4', 'cry-laugh', date('now', '-2 days'));

		-- Add heart reactions on comments (only heart reactions on comments, use subqueries for comment id)
		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('user1', 'comment', (SELECT id FROM comments WHERE text='Nice drawing!' AND user_id='user2' AND submission_id='sub1'), 'heart', date('now', '-6 days')),
			('user3', 'comment', (SELECT id FROM comments WHERE text='Nice drawing!' AND user_id='user2' AND submission_id='sub1'), 'heart', date('now', '-6 days')),
			('user2', 'comment', (SELECT id FROM comments WHERE text='Love the colors!' AND user_id='user3' AND submission_id='sub1'), 'heart', date('now', '-6 days')),
			('user1', 'comment', (SELECT id FROM comments WHERE text='Great job!' AND user_id='user2' AND submission_id='sub2'), 'heart', date('now', '-4 days')),
			('user3', 'comment', (SELECT id FROM comments WHERE text='This is my own work.' AND user_id='user1' AND submission_id='sub2'), 'heart', date('now', '-4 days')),
			('user2', 'comment', (SELECT id FROM comments WHERE text='Amazing!' AND user_id='user3' AND submission_id='sub3'), 'heart', date('now', '-3 days')),
			('user1', 'comment', (SELECT id FROM comments WHERE text='Thank you!' AND user_id='user1' AND submission_id='sub3'), 'heart', date('now', '-3 days')),
			('user3', 'comment', (SELECT id FROM comments WHERE text='So creative!' AND user_id='user2' AND submission_id='sub4'), 'heart', date('now', '-2 days')),
			('user2', 'comment', (SELECT id FROM comments WHERE text='Wow!' AND user_id='user3' AND submission_id='sub4'), 'heart', date('now', '-2 days'));
	`

	_, err = db.Exec(demoData)
	if err != nil {
		return fmt.Errorf("failed to insert demo data: %w", err)
	}

	log.Println("Demo data initialized successfully.")
	return nil
}
