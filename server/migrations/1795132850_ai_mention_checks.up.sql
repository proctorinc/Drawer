-- Comments that @mention an AI judge wait on the admin "ai mentions" page until a judge
-- replies after them or an admin checks them off by hand. This holds the hand check-offs.
CREATE TABLE ai_mention_checks (
    comment_id INTEGER PRIMARY KEY,
    checked_by TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
    FOREIGN KEY (checked_by) REFERENCES users (id) ON DELETE SET NULL
);
