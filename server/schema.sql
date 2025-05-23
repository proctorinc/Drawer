DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS user_submissions;
DROP TABLE IF EXISTS daily_prompts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS verification_tokens;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily prompts table
CREATE TABLE IF NOT EXISTS daily_prompts (
    day TEXT PRIMARY KEY, -- Store as TEXT in YYYY-MM-DD format
    colors TEXT NOT NULL, -- Store as JSON array string
    prompt TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User submissions table
CREATE TABLE IF NOT EXISTS user_submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    canvas_data TEXT NOT NULL, -- Store as JSON string containing drawing data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, day)
);

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    PRIMARY KEY (user_id, friend_id)
);

-- Verification tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_submissions_user_day ON user_submissions (user_id, day);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships (user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships (friend_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_email ON verification_tokens(email);

-- Insert initial users
INSERT OR IGNORE INTO users (id, name, email) VALUES 
    (lower(hex(randomblob(16))), 'Alice', 'alice@example.com'),
    (lower(hex(randomblob(16))), 'Bob', 'bob@example.com');

-- Insert daily prompts
INSERT OR IGNORE INTO daily_prompts (day, colors, prompt) VALUES 
    ('2025-04-29', '["#123456", "#789abc", "#def123"]', 'A hippopotamus'),
    ('2025-04-30', '["#123456", "#789abc", "#def123"]', 'A giraffe'),
    ('2025-05-01', '["#123456", "#789abc", "#def123"]', 'A zebra'),
    ('2025-05-02', '["#123456", "#789abc", "#def123"]', 'A lion'),
    ('2025-05-03', '["#123456", "#789abc", "#def123"]', 'A tiger'),
    ('2025-05-04', '["#123456", "#789abc", "#def123"]', 'A bear'),
    ('2025-05-05', '["#123456", "#789abc", "#def123"]', 'A fox'),
    ('2025-05-06', '["#123456", "#789abc", "#def123"]', 'A wolf');