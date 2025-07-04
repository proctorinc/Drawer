-- Migration to fix reactions table foreign key constraints
-- Remove the problematic content_id foreign keys that were causing constraint failures

-- Drop the existing foreign key constraints
PRAGMA foreign_keys=OFF;

-- Recreate the reactions table without the problematic foreign keys
CREATE TABLE reactions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('submission', 'comment')),
    content_id TEXT NOT NULL,
    reaction_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_type, content_id, reaction_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy data from old table to new table
INSERT INTO reactions_new 
SELECT id, user_id, content_type, content_id, reaction_id, created_at 
FROM reactions;

-- Drop the old table
DROP TABLE reactions;

-- Rename the new table to the original name
ALTER TABLE reactions_new RENAME TO reactions;

-- Recreate indexes
CREATE INDEX idx_reactions_content ON reactions(content_type, content_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);
CREATE INDEX idx_reactions_created_at ON reactions(created_at);

PRAGMA foreign_keys=ON; 