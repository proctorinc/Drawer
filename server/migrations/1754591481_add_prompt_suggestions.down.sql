DROP INDEX IF EXISTS idx_daily_prompts_user_credit;

CREATE TABLE daily_prompts_new (
    day TEXT PRIMARY KEY,
    colors TEXT NOT NULL,
    prompt TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
);

INSERT INTO daily_prompts_new (day, colors, prompt, created_at)
SELECT day, colors, prompt, created_at FROM daily_prompts;

DROP TABLE daily_prompts;
ALTER TABLE daily_prompts_new RENAME TO daily_prompts;

DROP TABLE prompt_suggestions;
