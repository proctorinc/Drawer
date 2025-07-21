-- Remove role index
DROP INDEX IF EXISTS idx_users_role;

-- Remove role column from users table
-- Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- This is a simplified version - in production you'd need to handle data migration
CREATE TABLE users_new (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table to new table (excluding role column)
INSERT INTO users_new (id, username, email, created_at)
SELECT id, username, email, created_at FROM users;

-- Drop old table and rename new table
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes that were on the original table
CREATE INDEX idx_users_email ON users (email);