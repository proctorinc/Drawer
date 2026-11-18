ALTER TABLE users ADD COLUMN clerk_id TEXT;
CREATE UNIQUE INDEX idx_users_clerk_id ON users (clerk_id);
