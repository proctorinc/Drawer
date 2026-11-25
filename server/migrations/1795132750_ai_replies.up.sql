-- An AI judge's reply in a doodle's comments, posted by an admin after reviewing its draft. Kept apart
-- from comments, which are players' own and count toward their trophies and stats.
CREATE TABLE ai_replies (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    personality_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES user_submissions (id) ON DELETE CASCADE,
    FOREIGN KEY (personality_id) REFERENCES ai_personalities (id)
);
CREATE INDEX idx_ai_replies_submission ON ai_replies (submission_id, created_at);
