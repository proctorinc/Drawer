-- Create reactions table
CREATE TABLE reactions (
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

-- Create indexes for better performance
CREATE INDEX idx_reactions_content ON reactions(content_type, content_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);
CREATE INDEX idx_reactions_created_at ON reactions(created_at);