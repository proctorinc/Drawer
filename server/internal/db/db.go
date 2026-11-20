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

		err = initializeDevData(res, cfg.DevUserEmail)

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

func initializeDevData(db *sql.DB, devUserEmail string) error {
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
		-- Insert achievements
		INSERT OR IGNORE INTO achievements (id, name, description, image_url, achievement_field, achievement_value)
		VALUES
			('achievement1', 'Baby''s first', 'Draw your first doodle', '', 'SUBMISSION_TOTAL', 1),
			('achievement2', 'Anti-antisocial?', 'Comment on a friends doodle', '', 'COMMENT_TOTAL', 1),
			('achievement3', 'Well that was easy', 'React to a friends doodle', '', 'REACTION_TOTAL', 1),
			('achievement3a', 'A friend of the people', 'Make 5 friends', '', 'FRIEND_TOTAL', 5),
			('achievement4', 'A dedicated citizen', 'Draw doodles for 5 days in a row', '', 'SUBMISSION_STREAK', 5),
			('achievement5', 'Doodle Kiddie', 'Draw 10 total doodles', '', 'SUBMISSION_TOTAL', 10),
			('achievement6', 'Doodle Pro', 'Draw 50 total doodles', '', 'SUBMISSION_TOTAL', 50),
			('achievement7', 'Doodle God', 'Draw 100 total doodles', '', 'SUBMISSION_TOTAL', 100);

		-- Insert reward unlocks
		INSERT OR IGNORE INTO reward_unlocks (id, name, description, created_at, achievement_id)
		VALUES
			('CUSTOM_PROFILE_PIC', 'Custom Profile Picture', 'You can now draw your own profile picture', date('now'), 'achievement4');

		-- Insert events (mirrors the seed in migrations/1795032990_add_events.up.sql)
		INSERT OR IGNORE INTO events (id, slug, name, theme, starts_at, ends_at, countdown_days)
		VALUES
			('event1', 'christmas-2026', 'Doodlemas', 'christmas', '2026-11-27T00:00:00Z', '2027-01-01T00:00:00Z', 29);

		-- Event reactions, stickers and prompts (mirror migrations/1795035100_add_event_features.up.sql
		-- and 1795035200_seed_christmas_prompts.up.sql)
		INSERT OR IGNORE INTO event_reactions (event_id, reaction_id) VALUES
			('event1', 'snowflake'),
			('event1', 'gift');

		INSERT OR IGNORE INTO achievements (id, name, description, image_url, achievement_field, achievement_value)
		VALUES
			('christmas-2026-first-snow', 'first snow', 'Draw your first doodle of Doodlemas', '', 'EVENT_SUBMISSION_TOTAL', 1),
			('christmas-2026-twelve-days', 'twelve days of doodles', 'Draw 12 doodles during Doodlemas', '', 'EVENT_SUBMISSION_TOTAL', 12),
			('christmas-2026-doodle-claus', 'doodle claus', 'Doodle every day from Nov 27 to Dec 25', '', 'EVENT_COUNTDOWN_TOTAL', 29);

		INSERT OR IGNORE INTO event_achievements (achievement_id, event_id) VALUES
			('christmas-2026-first-snow', 'event1'),
			('christmas-2026-twelve-days', 'event1'),
			('christmas-2026-doodle-claus', 'event1');

		-- Decorations (mirror migrations/1795040100_seed_christmas_decorations.up.sql)
		INSERT OR IGNORE INTO reward_unlocks (id, name, description, achievement_id) VALUES
			('FIRST_SNOW', 'First Snow', 'A drift of snow to wear on your face', 'christmas-2026-first-snow'),
			('CHRISTMAS_LIGHTS', 'Christmas Lights', 'A strand of twinkly lights to wear on your face', 'christmas-2026-twelve-days'),
			('GOLDEN_SANTA_HAT', 'Golden Santa Hat', 'A golden santa hat to wear on your face', 'christmas-2026-doodle-claus');

		-- Inserted before the relative demo prompts below so these win on overlapping days
		INSERT OR IGNORE INTO daily_prompts (day, colors, prompt) VALUES
			('2026-11-27', '["#E5483B", "#2F9E5B", "#FFB400", "#FFF8EC"]', 'leftovers in disguise'),
			('2026-11-28', '["#3A7BD5", "#9FD3F0", "#E5483B", "#F4F9FF"]', 'a snowman''s first day'),
			('2026-11-29', '["#8B5A2B", "#E5483B", "#F2E3C6", "#FFF8EC"]', 'a reindeer stuck in a chimney'),
			('2026-11-30', '["#2F9E5B", "#B22D4A", "#F2C14E", "#FBF6EE"]', 'a gingerbread house with a problem'),
			('2026-12-01', '["#6C3FC4", "#FF8FB1", "#FFD45A", "#FFF6FB"]', 'a penguin in a scarf'),
			('2026-12-02', '["#1F3A5F", "#FFB400", "#9FB6CF", "#F3F6FA"]', 'the world''s ugliest sweater'),
			('2026-12-03', '["#E5483B", "#2F9E5B", "#FFB400", "#FFF8EC"]', 'a cat versus the christmas tree'),
			('2026-12-04', '["#3A7BD5", "#9FD3F0", "#E5483B", "#F4F9FF"]', 'an epic snowball fight'),
			('2026-12-05', '["#8B5A2B", "#E5483B", "#F2E3C6", "#FFF8EC"]', 'hot cocoa with too many marshmallows'),
			('2026-12-06', '["#2F9E5B", "#B22D4A", "#F2C14E", "#FBF6EE"]', 'an elf on strike'),
			('2026-12-07', '["#6C3FC4", "#FF8FB1", "#FFD45A", "#FFF6FB"]', 'a polar bear ice skating'),
			('2026-12-08', '["#1F3A5F", "#FFB400", "#9FB6CF", "#F3F6FA"]', 'a present that''s way too big'),
			('2026-12-09', '["#E5483B", "#2F9E5B", "#FFB400", "#FFF8EC"]', 'santa''s sleigh breaking down'),
			('2026-12-10', '["#3A7BD5", "#9FD3F0", "#E5483B", "#F4F9FF"]', 'a candy cane in love'),
			('2026-12-11', '["#8B5A2B", "#E5483B", "#F2E3C6", "#FFF8EC"]', 'a mitten that lost its twin'),
			('2026-12-12', '["#2F9E5B", "#B22D4A", "#F2C14E", "#FBF6EE"]', 'a tangle of christmas lights'),
			('2026-12-13', '["#6C3FC4", "#FF8FB1", "#FFD45A", "#FFF6FB"]', 'a sledding disaster'),
			('2026-12-14', '["#1F3A5F", "#FFB400", "#9FB6CF", "#F3F6FA"]', 'a nutcracker at the gym'),
			('2026-12-15', '["#E5483B", "#2F9E5B", "#FFB400", "#FFF8EC"]', 'cookies left for santa (half eaten)'),
			('2026-12-16', '["#3A7BD5", "#9FD3F0", "#E5483B", "#F4F9FF"]', 'someone trapped in a snow globe'),
			('2026-12-17', '["#8B5A2B", "#E5483B", "#F2E3C6", "#FFF8EC"]', 'a reindeer''s day off'),
			('2026-12-18', '["#2F9E5B", "#B22D4A", "#F2C14E", "#FBF6EE"]', 'awkward under the mistletoe'),
			('2026-12-19', '["#6C3FC4", "#FF8FB1", "#FFD45A", "#FFF6FB"]', 'gift-wrapping a pet'),
			('2026-12-20', '["#1F3A5F", "#FFB400", "#9FB6CF", "#F3F6FA"]', 'caroling animals'),
			('2026-12-21', '["#E5483B", "#2F9E5B", "#FFB400", "#FFF8EC"]', 'the longest night of the year'),
			('2026-12-22', '["#3A7BD5", "#9FD3F0", "#E5483B", "#F4F9FF"]', 'stockings by the fireplace'),
			('2026-12-23', '["#8B5A2B", "#E5483B", "#F2E3C6", "#FFF8EC"]', 'the north pole''s busiest workshop'),
			('2026-12-24', '["#2F9E5B", "#B22D4A", "#F2C14E", "#FBF6EE"]', 'santa checking his list twice'),
			('2026-12-25', '["#6C3FC4", "#FF8FB1", "#FFD45A", "#FFF6FB"]', 'christmas morning');

		-- Insert demo users
		INSERT OR IGNORE INTO users (id, username, email, role, created_at, avatar_type, avatar_url) VALUES
			('user1', 'tankard_wellington', 'user1@example.com', 'admin', date('now', '-63 days'), 'custom', '/example.png'),
			('user2', 'wifey_p', 'user2@example.com', 'user', date('now', '-13 days'), 'basic', ''),
			('user3', 'matty_p', 'user3@example.com', 'user', date('now', '-13 days'), 'custom', '/example.png'),
			('user4', 'jimbo', 'user4@example.com', 'user', date('now', '-13 days'), 'basic', ''),
			('user5', 'jonny_p', 'user5@example.com', 'user', date('now', '-13 days'), 'basic', ''),
			('user6', 'ubebae', 'user6@example.com', 'user', date('now', '-13 days'), 'basic', ''),
			('user7', 'bufy', 'user7@example.com', 'user', date('now', '-13 days'), 'basic', ''),
			('user8', 'anonymous_hippopotamus', 'user8@example.com', 'user', date('now', '-13 days'), 'basic', ''),
			('user9', 'pro_tractor', 'user9@example.com', 'user', date('now', '-13 days'), 'basic', '');

		-- A few friends already wearing decorations
		UPDATE users SET decoration = 'GOLDEN_SANTA_HAT' WHERE id = 'user2';
		UPDATE users SET decoration = 'CHRISTMAS_LIGHTS' WHERE id = 'user3';
		UPDATE users SET decoration = 'FIRST_SNOW' WHERE id = 'user4';

		-- Insert prompt suggestions
		INSERT OR IGNORE INTO prompt_suggestions (id, user_id, prompt)
		VALUES
			('suggestion1', 'user1', 'A banana.'),
			('suggestion2', 'user1', 'This is a suggestion.'),
			('suggestion3', 'user2', 'Dancing in the moonlight. Everybody.'),
			('suggestion4', 'user3', 'A banana.'),
			('suggestion5', 'user7', 'Something cool.');

		-- Make them friends
		INSERT OR IGNORE INTO friendships (user1, user2, inviter_id, state) VALUES
			('user1', 'user2', 'user1', 'accepted'),
			('user1', 'user3', 'user1', 'accepted'),
			('user1', 'user4', 'user1', 'accepted'),
			('user1', 'user5', 'user1', 'accepted'),
			('user1', 'user6', 'user1', 'accepted'),
			('user1', 'user7', 'user1', 'pending'),
			('user1', 'user8', 'user8', 'pending');

		INSERT OR IGNORE INTO daily_prompts (day, colors, prompt, created_by) VALUES
			(date('now', '-13 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A sunset over mountains', 'user1'),
			(date('now', '-8 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A test thing', 'user1'),
			(date('now', '-7 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A cool forest', 'user1'),
			(date('now', '-6 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A banana', 'user1'),
			(date('now', '-5 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A curved yellow fruit', 'user1'),
			(date('now', '-4 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A peanut butter sandwich', 'user1'),
			(date('now', '-3 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A goalie', 'user1'),
			(date('now', '-2 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A futbol americano', 'user1'),
			(date('now', '-1 days'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A prank', 'user1'),
			(date('now'), '["#2C3E50", "#34495E", "#7F8C8D"]', 'A prehistoric city', 'user1'),
			(date('now', '+1 days'), '["#E74C3C", "#C0392B", "#A93226"]', 'A tangerine', 'user1'),
			-- Intentionally missing +2 days to show gap
			(date('now', '+3 days'), '["#F39C12", "#E67E22", "#D35400"]', 'A cozy fireplace', 'user1'),
			(date('now', '+4 days'), '["#9B59B6", "#8E44AD", "#7D3C98"]', 'A magical forest', 'user1'),
			-- Intentionally missing +5 days to show gap
			(date('now', '+6 days'), '["#3498DB", "#2980B9", "#21618C"]', 'A calm ocean wave', 'user1'),
			(date('now', '+7 days'), '["#1ABC9C", "#16A085", "#138D75"]', 'A vintage camera', 'user1'),
			(date('now', '+8 days'), '["#E67E22", "#D35400", "#BA4A00"]', 'A hot air balloon', 'user1'),
			-- Intentionally missing +9 days to show gap
			(date('now', '+10 days'), '["#8E44AD", "#7D3C98", "#6C3483"]', 'A starry night sky', 'user1'),
			(date('now', '+11 days'), '["#27AE60", "#229954", "#1E8449"]', 'A blooming flower', 'user1'),
			(date('now', '+12 days'), '["#F1C40F", "#F39C12", "#E67E22"]', 'A golden sunset', 'user1'),
			(date('now', '+13 days'), '["#E91E63", "#C2185B", "#AD1457"]', 'A butterfly garden', 'user1'),
			-- Intentionally missing +14 days to show gap
			(date('now', '+15 days'), '["#3F51B5", "#303F9F", "#283593"]', 'A mountain peak', 'user1'),
			(date('now', '+16 days'), '["#009688", "#00796B", "#00695C"]', 'A zen garden', 'user1'),
			(date('now', '+17 days'), '["#FF5722", "#E64A19", "#D84315"]', 'A roaring campfire', 'user1'),
			(date('now', '+18 days'), '["#673AB7", "#5E35B1", "#512DA8"]', 'A crystal cave', 'user1'),
			(date('now', '+19 days'), '["#00BCD4", "#00ACC1", "#0097A7"]', 'A tropical island', 'user1'),
			(date('now', '+20 days'), '["#4CAF50", "#43A047", "#388E3C"]', 'A peaceful meadow', 'user1');

		INSERT OR IGNORE INTO user_submissions (id, user_id, day) VALUES
			('sub00', 'user1', date('now', '-60 days')),
			('sub0', 'user1', date('now', '-30 days')),
			('sub1', 'user1', date('now', '-6 days')),
			('sub2', 'user1', date('now', '-4 days')),
			('sub3', 'user1', date('now', '-3 days')),
			('sub4', 'user1', date('now', '-2 days')),
			('sub5', 'user2', date('now', '-6 days')),
			('sub6', 'user2', date('now', '-4 days')),
			('sub7', 'user2', date('now', '-3 days')),
			('sub8', 'user2', date('now', '-2 days')),
			('sub9', 'user2', date('now', '-1 days')),
			('sub10', 'user1', date('now', '-1 days')),
			('sub11', 'user1', date('now'));

		-- Christmas event doodles, so the event's progress, leaderboard and recap have data when
		-- QA'ing with EVENTS_FAKE_NOW (e.g. 2026-12-05)
		INSERT OR IGNORE INTO user_submissions (id, user_id, day) VALUES
			('xmas1', 'user1', '2026-11-27'),
			('xmas2', 'user1', '2026-11-28'),
			('xmas3', 'user1', '2026-11-29'),
			('xmas4', 'user1', '2026-12-01'),
			('xmas5', 'user1', '2026-12-02'),
			('xmas6', 'user2', '2026-11-27'),
			('xmas7', 'user2', '2026-11-28'),
			('xmas8', 'user3', '2026-11-30');

		INSERT INTO comments (submission_id, user_id, text, created_at) VALUES
			('sub1', 'user2', 'Nice drawing!', date('now', '-6 days')),
			('sub1', 'user3', 'Love the colors!', date('now', '-6 days')),
			('sub2', 'user1', 'This is my own work.', date('now', '-4 days')),
			('sub2', 'user2', 'Great job!', date('now', '-4 days')),
			('sub3', 'user3', 'Amazing!', date('now', '-3 days')),
			('sub3', 'user1', 'Thank you!', date('now', '-3 days')),
			('sub4', 'user2', 'So creative!', date('now', '-2 days')),
			('sub4', 'user3', 'Wow!', date('now', '-2 days')),
			('sub4', 'user1', 'Thanks guys', date('now')),
			('sub4', 'user1', 'I am a design', date('now'));

		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('user2', 'submission', 'sub1', 'fire', date('now', '-6 days')),
			('user3', 'submission', 'sub1', 'heart', date('now', '-6 days')),
			('user1', 'submission', 'sub2', 'fire', date('now', '-4 days')),
			('user2', 'submission', 'sub2', 'cry-laugh', date('now', '-4 days')),
			('user3', 'submission', 'sub3', 'face-meh', date('now', '-3 days')),
			('user1', 'submission', 'sub3', 'fire', date('now', '-3 days')),
			('user2', 'submission', 'sub4', 'fire', date('now', '-2 days')),
			('user3', 'submission', 'sub4', 'cry-laugh', date('now', '-2 days'));

		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('user2', 'submission', 'xmas1', 'snowflake', '2026-11-27'),
			('user3', 'submission', 'xmas1', 'gift', '2026-11-27'),
			('user2', 'submission', 'xmas2', 'heart', '2026-11-28'),
			('user1', 'submission', 'xmas6', 'snowflake', '2026-11-27');

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

	// The AI judges, from the same seed production gets (it needs event1 from above)
	aiSeed, err := os.ReadFile("./migrations/1795130100_seed_ai_judges.up.sql")
	if err != nil {
		return fmt.Errorf("failed to read AI judge seed: %w", err)
	}
	if _, err = db.Exec(string(aiSeed)); err != nil {
		return fmt.Errorf("failed to seed AI judges: %w", err)
	}
	composition, err := os.ReadFile("./migrations/1795130300_doodleton_composition.up.sql")
	if err != nil {
		return fmt.Errorf("failed to read Sir Doodleton's composition criterion: %w", err)
	}
	if _, err = db.Exec(string(composition)); err != nil {
		return fmt.Errorf("failed to add Sir Doodleton's composition criterion: %w", err)
	}
	styles, err := os.ReadFile("./migrations/1795130500_judge_comment_styles.up.sql")
	if err != nil {
		return fmt.Errorf("failed to read the judges' comment styles: %w", err)
	}
	if _, err = db.Exec(string(styles)); err != nil {
		return fmt.Errorf("failed to add the judges' comment styles: %w", err)
	}

	// Sample reviews, so the AI comments show up without an OpenAI key
	_, err = db.Exec(`
		INSERT INTO ai_reviews (submission_id, personality_id, status, score, criteria_scores, comment, model, created_at, updated_at) VALUES
			('sub4', 'ai-sir-doodleton', 'done', 3.5,
			 '[{"id":"ai-sir-doodleton-skill","name":"skill","description":"How well it is drawn: confident lines, shapes, proportion, use of the palette. Would it survive a gallery wall?","imageUrl":"/reactions/palette.png","score":3},{"id":"ai-sir-doodleton-recognizability","name":"recognizability","description":"How unmistakably it shows the prompt. Could a stranger name the prompt from the doodle alone?","imageUrl":"/reactions/bullseye.png","score":4}]',
			 'Magnifique! Truly the Mona Lisa of things a toddler might tape to a fridge. One simply cannot call this a football.',
			 'seed', date('now', '-2 days'), date('now', '-2 days')),
			('sub3', 'ai-sir-doodleton', 'done', 8.5,
			 '[{"id":"ai-sir-doodleton-skill","name":"skill","description":"How well it is drawn: confident lines, shapes, proportion, use of the palette. Would it survive a gallery wall?","imageUrl":"/reactions/palette.png","score":8},{"id":"ai-sir-doodleton-recognizability","name":"recognizability","description":"How unmistakably it shows the prompt. Could a stranger name the prompt from the doodle alone?","imageUrl":"/reactions/bullseye.png","score":9}]',
			 'I wept. Not from joy, from jealousy. Do not tell anyone I said this.',
			 'seed', date('now', '-3 days'), date('now', '-3 days')),
			('sub2', 'ai-professor-pickles', 'done', 8.7,
			 '[{"id":"ai-professor-pickles-funny","name":"funny bone","description":"How hard it made you laugh: jokes, sight gags, ridiculous details.","imageUrl":"/reactions/cry-laugh.png","score":9},{"id":"ai-professor-pickles-clever","name":"big brain","description":"How clever the take on the prompt is: puns, wordplay, a twist nobody else would think of.","imageUrl":"/reactions/brain.png","score":8},{"id":"ai-professor-pickles-freestyle","name":"freestyle","description":"Creative freedom: wild ideas, bold choices, going somewhere unexpected with it.","imageUrl":"/reactions/rainbow.png","score":9}]',
			 'A peanut butter sandwich with a face?! Now THAT is my jam! I laughed so hard I lost some brine!',
			 'seed', date('now', '-4 days'), date('now', '-4 days')),
			('xmas1', 'ai-santa', 'done', 7.3,
			 '[{"id":"ai-santa-nice-list","name":"nice list","description":"Effort and care. Did they try their very best, or phone it in?","imageUrl":"/reactions/star.png","score":8},{"id":"ai-santa-christmas-spirit","name":"christmas spirit","description":"How festive, cheerful and cozy it feels.","imageUrl":"/reactions/snowflake.svg","score":7},{"id":"ai-santa-workshop-quality","name":"workshop quality","description":"How well it captures the prompt. Would the elves sign off on it?","imageUrl":"/reactions/gift.svg","score":7}]',
			 'Ho ho ho! Those leftovers look tastier than Mrs. Claus''s fruitcake, but that is NOT how my turkey sits.',
			 'seed', '2026-11-27', '2026-11-27');
	`)
	if err != nil {
		return fmt.Errorf("failed to insert sample AI reviews: %w", err)
	}

	// The AI log entries those reviews would have made, plus a failed test run
	_, err = db.Exec(`
		INSERT INTO ai_runs (id, kind, personality_id, judge_name, judge_avatar_url, judge_decoration, system_prompt,
			submission_id, prompt, user_id, status, score, criteria_scores, comment, model, duration_ms, created_at)
		SELECT 'seed-' || r.submission_id, 'submission', p.id, p.name, p.avatar_url, p.decoration, p.system_prompt,
			r.submission_id, COALESCE(dp.prompt, ''), s.user_id, 'done', r.score, r.criteria_scores, r.comment, 'seed', 2300, r.created_at
		FROM ai_reviews r
		JOIN ai_personalities p ON p.id = r.personality_id
		JOIN user_submissions s ON s.id = r.submission_id
		LEFT JOIN daily_prompts dp ON dp.day = s.day;

		INSERT INTO ai_runs (id, kind, batch_id, personality_id, judge_name, judge_avatar_url, judge_decoration, system_prompt,
			prompt, user_id, status, model, error, duration_ms, created_at)
		SELECT 'seed-failed-test', 'test', 'seed-batch', id, name, avatar_url, decoration, system_prompt,
			'a cat riding a skateboard', 'user1', 'failed', 'seed', 'OpenAI error (429): Rate limit reached', 900, datetime('now', '-1 hours')
		FROM ai_personalities WHERE id = 'ai-professor-pickles';
	`)
	if err != nil {
		return fmt.Errorf("failed to insert sample AI runs: %w", err)
	}

	// Lets the developer sign in with Clerk as the seeded admin, user1
	if devUserEmail != "" {
		if _, err = db.Exec(`UPDATE users SET email = ? WHERE id = 'user1'`, devUserEmail); err != nil {
			return fmt.Errorf("failed to set dev user email: %w", err)
		}
	}

	log.Println("Demo data initialized successfully.")
	return nil
}
