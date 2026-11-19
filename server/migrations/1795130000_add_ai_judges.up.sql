-- AI judges: personalities that score each new doodle and leave a short comment on it

-- Admin-editable settings (the OpenAI key, the model, the on/off switch), as key/value rows
CREATE TABLE ai_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- A judge's character. Every score is out of 10. The default one judges every day; an event's judge takes over while
-- that event runs. decoration is an AI-only decoration id the frontend knows how to draw.
CREATE TABLE ai_personalities (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', system_prompt TEXT NOT NULL, avatar_url TEXT NOT NULL DEFAULT '', decoration TEXT NOT NULL DEFAULT '', is_default INTEGER NOT NULL DEFAULT 0, event_id TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL);
CREATE UNIQUE INDEX idx_ai_personalities_default ON ai_personalities (is_default) WHERE is_default = 1;
CREATE INDEX idx_ai_personalities_event_id ON ai_personalities (event_id);

-- Up to three things a judge scores separately, each out of 10; the overall score is then
-- their average, to one decimal place
CREATE TABLE ai_criteria (id TEXT PRIMARY KEY, personality_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', FOREIGN KEY (personality_id) REFERENCES ai_personalities (id) ON DELETE CASCADE);
CREATE INDEX idx_ai_criteria_personality_id ON ai_criteria (personality_id);

-- One review per doodle, scored out of 10. criteria_scores snapshots each criterion as it was when judged,
-- so editing a judge later doesn't rewrite old reviews.
CREATE TABLE ai_reviews (submission_id TEXT PRIMARY KEY, personality_id TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'failed')), score REAL, criteria_scores TEXT NOT NULL DEFAULT '[]', comment TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (submission_id) REFERENCES user_submissions (id) ON DELETE CASCADE, FOREIGN KEY (personality_id) REFERENCES ai_personalities (id));
CREATE INDEX idx_ai_reviews_personality_id ON ai_reviews (personality_id);
CREATE INDEX idx_ai_reviews_created_at ON ai_reviews (created_at);

-- Every time a judge was asked about a doodle, for the admin AI log: real doodles, admin
-- re-runs and testing-ground runs. Judges are snapshotted (name, face, prompt) so the log
-- shows what actually ran. image_data holds custom testing-ground drawings only; other
-- runs point at their submission. Nothing here is ever shown to players.
CREATE TABLE ai_runs (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('submission', 'rerun', 'test')), batch_id TEXT NOT NULL DEFAULT '', personality_id TEXT NOT NULL, judge_name TEXT NOT NULL, judge_avatar_url TEXT NOT NULL DEFAULT '', judge_decoration TEXT NOT NULL DEFAULT '', system_prompt TEXT NOT NULL DEFAULT '', submission_id TEXT, prompt TEXT NOT NULL DEFAULT '', image_data TEXT NOT NULL DEFAULT '', user_id TEXT, status TEXT NOT NULL CHECK (status IN ('done', 'failed')), score REAL, criteria_scores TEXT NOT NULL DEFAULT '[]', comment TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', duration_ms INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_ai_runs_created_at ON ai_runs (created_at);
CREATE INDEX idx_ai_runs_kind ON ai_runs (kind);
