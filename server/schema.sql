CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS user_submissions;
DROP TABLE IF EXISTS daily_prompts;
DROP TABLE IF EXISTS users;

-- Users table (simplified for this example)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily prompts table
CREATE TABLE IF NOT EXISTS daily_prompts (
    day DATE PRIMARY KEY, -- Ensures one prompt per day
    colors TEXT[] NOT NULL, -- Array of color strings
    prompt TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User submissions table
CREATE TABLE IF NOT EXISTS user_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES users(id),
    day DATE NOT NULL,
    file_path VARCHAR(255) NOT NULL, -- Store path relative to upload dir or full URL
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, day) -- Ensures only one submission per user per day
);

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
    user_id UUID NOT NULL REFERENCES users(id),
    friend_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id)
);

-- Optional: Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_submissions_user_day ON user_submissions (user_id, day);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships (user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships (friend_id);

-- Insert initial users
INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com') ON CONFLICT (id) DO NOTHING;

-- Insert daily prompts
INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2025-04-29', ARRAY['#123456', '#789abc', '#def123'], 'A hippopotamus') ON CONFLICT (day) DO NOTHING;
INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2025-04-30', ARRAY['#123456', '#789abc', '#def123'], 'A giraffe') ON CONFLICT (day) DO NOTHING;
INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2025-05-01', ARRAY['#123456', '#789abc', '#def123'], 'A zebra') ON CONFLICT (day) DO NOTHING;
INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2025-05-02', ARRAY['#123456', '#789abc', '#def123'], 'A lion') ON CONFLICT (day) DO NOTHING;
INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2025-05-03', ARRAY['#123456', '#789abc', '#def123'], 'A tiger') ON CONFLICT (day) DO NOTHING;
INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2025-05-04', ARRAY['#123456', '#789abc', '#def123'], 'A bear') ON CONFLICT (day) DO NOTHING;
INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2025-05-05', ARRAY['#123456', '#789abc', '#def123'], 'A fox') ON CONFLICT (day) DO NOTHING;
INSERT INTO daily_prompts (day, colors, prompt) VALUES ('2025-05-06', ARRAY['#123456', '#789abc', '#def123'], 'A wolf') ON CONFLICT (day) DO NOTHING;