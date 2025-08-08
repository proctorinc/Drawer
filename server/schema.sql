-- Drop tables in correct order (dependent tables first)
DROP TABLE IF EXISTS verification_tokens;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS user_submissions;
DROP TABLE IF EXISTS daily_prompts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS schema_migrations;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS activity_reads;
DROP TABLE IF EXISTS user_favorite_submissions;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS reward_unlocks;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS user_achievement_checks;
DROP TABLE IF EXISTS user_stat_calculations;
DROP TABLE IF EXISTS prompt_suggestions;

-- CREATE TABLE users (
--     id TEXT PRIMARY KEY,
--     username TEXT UNIQUE NOT NULL,
--     email TEXT UNIQUE NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE TABLE daily_prompts (
--     day TEXT PRIMARY KEY, -- Store as TEXT in YYYY-MM-DD format
--     colors TEXT NOT NULL, -- Store as JSON array string
--     prompt TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE TABLE user_submissions (
--     id TEXT PRIMARY KEY,
--     user_id TEXT NOT NULL,
--     day TEXT NOT NULL,
--     canvas_data TEXT NOT NULL, -- Store as JSON string containing drawing data
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--     UNIQUE(user_id, day)
-- );
-- CREATE TABLE friendships (
--     user_id TEXT NOT NULL,
--     friend_id TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--     FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
--     PRIMARY KEY (user_id, friend_id)
-- );
-- CREATE TABLE verification_tokens (
--     token TEXT PRIMARY KEY,
--     user_id TEXT NOT NULL,
--     email TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     expires_at TIMESTAMP NOT NULL,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );
-- CREATE INDEX idx_user_submissions_user_day ON user_submissions (user_id, day);
-- CREATE INDEX idx_users_email ON users (email);
-- CREATE INDEX idx_friendships_user ON friendships (user_id);
-- CREATE INDEX idx_friendships_friend ON friendships (friend_id);
-- CREATE INDEX idx_verification_tokens_user_id ON verification_tokens(user_id);
-- CREATE INDEX idx_verification_tokens_email ON verification_tokens(email);
-- CREATE TABLE schema_migrations (id VARCHAR(255) NOT NULL PRIMARY KEY);
