DROP INDEX IF EXISTS idx_daily_prompts_created_by;

CREATE TABLE daily_prompts_new (
    day TEXT PRIMARY KEY, -- Store as TEXT in YYYY-MM-DD format
    colors TEXT NOT NULL, -- Store as JSON array string
    prompt TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy data from old table to new table (excluding role column)
INSERT INTO daily_prompts_new (day, colors, prompt, created_at)
SELECT day, colors, prompt, created_at FROM daily_prompts;

-- Drop old table and rename new table
DROP TABLE daily_prompts;
ALTER TABLE daily_prompts_new RENAME TO daily_prompts;

-- Recreate indexes that were on the original table
CREATE INDEX idx_daily_prompts_created_by ON daily_prompts (created_by);

CREATE TABLE prompt_suggestions (
    id STRING PRIMARY KEY,
    prompt TEXT NOT NULL,
    user_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
