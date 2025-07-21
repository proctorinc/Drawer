-- Add role column to users table
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for role-based queries
CREATE INDEX idx_users_role ON users (role);