-- Migration to restore reactions table foreign key constraints
-- Add back the content_id foreign keys that were removed in the up migration

-- Drop the existing foreign key constraints
PRAGMA foreign_keys=OFF;

-- Recreate the reactions table with the original foreign keys
CREATE TABLE reactions_old (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('submission', 'comment')),
    content_id TEXT NOT NULL,
    reaction_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_type, content_id, reaction_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES user_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Copy data from current table to old table
INSERT INTO reactions_old 
SELECT id, user_id, content_type, content_id, reaction_id, created_at 
FROM reactions;

-- Drop the current table
DROP TABLE reactions;

-- Rename the old table to the original name
ALTER TABLE reactions_old RENAME TO reactions;

-- Recreate indexes
CREATE INDEX idx_reactions_content ON reactions(content_type, content_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);
CREATE INDEX idx_reactions_created_at ON reactions(created_at);

PRAGMA foreign_keys=ON;