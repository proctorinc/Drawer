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

	log.Println("Database schema initialized successfully.")

	// Add demo data
	demoData := `
		-- Insert demo users
		INSERT OR IGNORE INTO users (id, username, email, created_at) VALUES 
			('user1', 'TankardWellington', 'demo1@example.com', date('now', '-13 days')),
			('user2', 'Pro-tractor', 'demo2@example.com', date('now', '-13 days')),
			('user3', 'Octorpray', 'demo3@example.com', date('now', '-13 days'));

		-- Make them friends
		INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES 
			('user1', 'user2'),
			('user2', 'user1'),
			('user1', 'user3'),
			('user3', 'user1');

		-- Add prompts for the last 2 days and today
		INSERT OR IGNORE INTO daily_prompts (day, colors, prompt) VALUES 
			(date('now', '-13 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A sunset over mountains'),
			(date('now', '-8 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A sunset over mountains'),
			(date('now', '-7 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A magical forest'),
			(date('now', '-6 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A sunset over mountains'),
			(date('now', '-5 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A magical forest'),
			(date('now', '-4 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A sunset over mountains'),
			(date('now', '-3 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A magical forest'),
			(date('now', '-2 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A sunset over mountains'),
			(date('now', '-1 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A magical forest'),
			(date('now'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A futuristic city'),
			(date('now', '+1 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A Banana'),
			(date('now', '+2 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'An Orange banana');

		-- Add submissions for the last 2 days
		INSERT OR IGNORE INTO user_submissions (id, user_id, day, canvas_data) VALUES 
			('sub1', 'user1', date('now', '-6 days'), '"[{\"type\":\"path\",\"points\":[{\"x\":45.99,\"y\":40.45},{\"x\":45.72,\"y\":40.45},{\"x\":45.32,\"y\":40.68},{\"x\":45.20,\"y\":41.18},{\"x\":45.07,\"y\":41.57},{\"x\":44.93,\"y\":41.80},{\"x\":45.29,\"y\":41.93},{\"x\":46.94,\"y\":41.09},{\"x\":53.17,\"y\":36.54},{\"x\":58.93,\"y\":32.37},{\"x\":63.86,\"y\":28.44},{\"x\":68.41,\"y\":24.12},{\"x\":72.10,\"y\":20.46},{\"x\":75.13,\"y\":18.07},{\"x\":78.27,\"y\":15.61},{\"x\":80.38,\"y\":13.91},{\"x\":81.42,\"y\":13.06},{\"x\":81.53,\"y\":13.81},{\"x\":78.88,\"y\":17.04},{\"x\":74.27,\"y\":22.21},{\"x\":67.94,\"y\":28.89},{\"x\":60.96,\"y\":36.53},{\"x\":53.22,\"y\":44.94},{\"x\":44.90,\"y\":54.01},{\"x\":39.19,\"y\":60.69},{\"x\":31.13,\"y\":70.84},{\"x\":25.73,\"y\":77.84},{\"x\":22.09,\"y\":83.04},{\"x\":19.50,\"y\":87.35},{\"x\":16.93,\"y\":91.95},{\"x\":15.32,\"y\":95.66},{\"x\":14.30,\"y\":98.68},{\"x\":13.82,\"y\":101.01},{\"x\":13.79,\"y\":102.49},{\"x\":13.78,\"y\":103.45},{\"x\":14.31,\"y\":104.47},{\"x\":15.88,\"y\":104.72},{\"x\":18.63,\"y\":104.79},{\"x\":22.39,\"y\":103.00},{\"x\":27.21,\"y\":98.33},{\"x\":35.92,\"y\":88.34},{\"x\":45.11,\"y\":77.25},{\"x\":53.06,\"y\":67.44},{\"x\":60.03,\"y\":58.72},{\"x\":66.22,\"y\":51.24},{\"x\":73.18,\"y\":42.82},{\"x\":76.40,\"y\":38.84},{\"x\":79.13,\"y\":35.58},{\"x\":81.07,\"y\":33.33},{\"x\":82.17,\"y\":32.15},{\"x\":82.65,\"y\":31.90},{\"x\":81.51,\"y\":34.03},{\"x\":78.01,\"y\":38.82},{\"x\":69.13,\"y\":49.92},{\"x\":62.47,\"y\":58.78},{\"x\":55.40,\"y\":68.83},{\"x\":47.85,\"y\":79.94},{\"x\":237.11,\"y\":186.77}],\"color\":\"#2C3E50\",\"lineWidth\":32}]"'),
			('sub2', 'user1', date('now', '-4 days'), '"[{\"type\":\"path\",\"points\":[{\"x\":100.99,\"y\":80.45},{\"x\":100.72,\"y\":80.45},{\"x\":100.32,\"y\":80.68},{\"x\":100.20,\"y\":81.18},{\"x\":100.07,\"y\":81.57},{\"x\":99.93,\"y\":81.80},{\"x\":100.29,\"y\":81.93},{\"x\":101.94,\"y\":81.09},{\"x\":108.17,\"y\":76.54},{\"x\":113.93,\"y\":72.37},{\"x\":118.86,\"y\":68.44},{\"x\":123.41,\"y\":64.12},{\"x\":127.10,\"y\":60.46},{\"x\":130.13,\"y\":58.07},{\"x\":133.27,\"y\":55.61},{\"x\":135.38,\"y\":53.91},{\"x\":136.42,\"y\":53.06},{\"x\":136.53,\"y\":53.81},{\"x\":133.88,\"y\":57.04},{\"x\":129.27,\"y\":62.21},{\"x\":122.94,\"y\":68.89},{\"x\":115.96,\"y\":76.53},{\"x\":108.22,\"y\":84.94},{\"x\":99.90,\"y\":94.01},{\"x\":94.19,\"y\":100.69},{\"x\":86.13,\"y\":110.84},{\"x\":80.73,\"y\":117.84},{\"x\":77.09,\"y\":123.04},{\"x\":74.50,\"y\":127.35},{\"x\":71.93,\"y\":131.95},{\"x\":70.32,\"y\":135.66},{\"x\":69.30,\"y\":138.68},{\"x\":68.82,\"y\":141.01},{\"x\":68.79,\"y\":142.49},{\"x\":68.78,\"y\":143.45},{\"x\":69.31,\"y\":144.47},{\"x\":70.88,\"y\":144.72},{\"x\":73.63,\"y\":144.79},{\"x\":77.39,\"y\":143.00},{\"x\":82.21,\"y\":138.33},{\"x\":90.92,\"y\":128.34},{\"x\":100.11,\"y\":117.25},{\"x\":108.06,\"y\":107.44},{\"x\":115.03,\"y\":98.72},{\"x\":121.22,\"y\":91.24},{\"x\":128.18,\"y\":82.82},{\"x\":131.40,\"y\":78.84},{\"x\":134.13,\"y\":75.58},{\"x\":136.07,\"y\":73.33},{\"x\":137.17,\"y\":72.15},{\"x\":137.65,\"y\":71.90},{\"x\":136.51,\"y\":74.03},{\"x\":133.01,\"y\":78.82},{\"x\":124.13,\"y\":89.92},{\"x\":117.47,\"y\":98.78},{\"x\":110.40,\"y\":108.83},{\"x\":102.85,\"y\":119.94},{\"x\":292.11,\"y\":226.77}],\"color\":\"#34495E\",\"lineWidth\":32}]"'),
			('sub3', 'user1', date('now', '-3 days'), '"[{\"type\":\"path\",\"points\":[{\"x\":150.99,\"y\":120.45},{\"x\":150.72,\"y\":120.45},{\"x\":150.32,\"y\":120.68},{\"x\":150.20,\"y\":121.18},{\"x\":150.07,\"y\":121.57},{\"x\":149.93,\"y\":121.80},{\"x\":150.29,\"y\":121.93},{\"x\":151.94,\"y\":121.09},{\"x\":158.17,\"y\":116.54},{\"x\":163.93,\"y\":112.37},{\"x\":168.86,\"y\":108.44},{\"x\":173.41,\"y\":104.12},{\"x\":177.10,\"y\":100.46},{\"x\":180.13,\"y\":98.07},{\"x\":183.27,\"y\":95.61},{\"x\":185.38,\"y\":93.91},{\"x\":186.42,\"y\":93.06},{\"x\":186.53,\"y\":93.81},{\"x\":183.88,\"y\":97.04},{\"x\":179.27,\"y\":102.21},{\"x\":172.94,\"y\":108.89},{\"x\":165.96,\"y\":116.53},{\"x\":158.22,\"y\":124.94},{\"x\":149.90,\"y\":134.01},{\"x\":144.19,\"y\":140.69},{\"x\":136.13,\"y\":150.84},{\"x\":130.73,\"y\":157.84},{\"x\":127.09,\"y\":163.04},{\"x\":124.50,\"y\":167.35},{\"x\":121.93,\"y\":171.95},{\"x\":120.32,\"y\":175.66},{\"x\":119.30,\"y\":178.68},{\"x\":118.82,\"y\":181.01},{\"x\":118.79,\"y\":182.49},{\"x\":118.78,\"y\":183.45},{\"x\":119.31,\"y\":184.47},{\"x\":120.88,\"y\":184.72},{\"x\":123.63,\"y\":184.79},{\"x\":127.39,\"y\":183.00},{\"x\":132.21,\"y\":178.33},{\"x\":140.92,\"y\":168.34},{\"x\":150.11,\"y\":157.25},{\"x\":158.06,\"y\":147.44},{\"x\":165.03,\"y\":138.72},{\"x\":171.22,\"y\":131.24},{\"x\":178.18,\"y\":122.82},{\"x\":181.40,\"y\":118.84},{\"x\":184.13,\"y\":115.58},{\"x\":186.07,\"y\":113.33},{\"x\":187.17,\"y\":112.15},{\"x\":187.65,\"y\":111.90},{\"x\":186.51,\"y\":114.03},{\"x\":183.01,\"y\":118.82},{\"x\":174.13,\"y\":129.92},{\"x\":167.47,\"y\":138.78},{\"x\":160.40,\"y\":148.83},{\"x\":152.85,\"y\":159.94},{\"x\":342.11,\"y\":266.77}],\"color\":\"#7F8C8D\",\"lineWidth\":32}]"'),
			('sub4', 'user1', date('now', '-2 days'), '"[{\"type\":\"path\",\"points\":[{\"x\":200.99,\"y\":160.45},{\"x\":200.72,\"y\":160.45},{\"x\":200.32,\"y\":160.68},{\"x\":200.20,\"y\":161.18},{\"x\":200.07,\"y\":161.57},{\"x\":199.93,\"y\":161.80},{\"x\":200.29,\"y\":161.93},{\"x\":201.94,\"y\":161.09},{\"x\":208.17,\"y\":156.54},{\"x\":213.93,\"y\":152.37},{\"x\":218.86,\"y\":148.44},{\"x\":223.41,\"y\":144.12},{\"x\":227.10,\"y\":140.46},{\"x\":230.13,\"y\":138.07},{\"x\":233.27,\"y\":135.61},{\"x\":235.38,\"y\":133.91},{\"x\":236.42,\"y\":133.06},{\"x\":236.53,\"y\":133.81},{\"x\":233.88,\"y\":137.04},{\"x\":229.27,\"y\":142.21},{\"x\":222.94,\"y\":148.89},{\"x\":215.96,\"y\":156.53},{\"x\":208.22,\"y\":164.94},{\"x\":199.90,\"y\":174.01},{\"x\":194.19,\"y\":180.69},{\"x\":186.13,\"y\":190.84},{\"x\":180.73,\"y\":197.84},{\"x\":177.09,\"y\":203.04},{\"x\":174.50,\"y\":207.35},{\"x\":171.93,\"y\":211.95},{\"x\":170.32,\"y\":215.66},{\"x\":169.30,\"y\":218.68},{\"x\":168.82,\"y\":221.01},{\"x\":168.79,\"y\":222.49},{\"x\":168.78,\"y\":223.45},{\"x\":169.31,\"y\":224.47},{\"x\":170.88,\"y\":224.72},{\"x\":173.63,\"y\":224.79},{\"x\":177.39,\"y\":223.00},{\"x\":182.21,\"y\":218.33},{\"x\":190.92,\"y\":208.34},{\"x\":200.11,\"y\":197.25},{\"x\":208.06,\"y\":187.44},{\"x\":215.03,\"y\":178.72},{\"x\":221.22,\"y\":171.24},{\"x\":228.18,\"y\":162.82},{\"x\":231.40,\"y\":158.84},{\"x\":234.13,\"y\":155.58},{\"x\":236.07,\"y\":153.33},{\"x\":237.17,\"y\":152.15},{\"x\":237.65,\"y\":151.90},{\"x\":236.51,\"y\":154.03},{\"x\":233.01,\"y\":158.82},{\"x\":224.13,\"y\":169.92},{\"x\":217.47,\"y\":178.78},{\"x\":210.40,\"y\":188.83},{\"x\":202.85,\"y\":199.94},{\"x\":392.11,\"y\":306.77}],\"color\":\"#2C3E50\",\"lineWidth\":32}]"');
	`

	_, err = db.Exec(demoData)
	if err != nil {
		return fmt.Errorf("failed to insert demo data: %w", err)
	}

	log.Println("Demo data initialized successfully.")
	return nil
}
