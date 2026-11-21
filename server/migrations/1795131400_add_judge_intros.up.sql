-- Each judge's intro for a day, written once and shared by everyone. Keyed by what it was
-- written from, so a new prompt or an edited personality gets a fresh one.
CREATE TABLE judge_intros (
    day TEXT NOT NULL,
    personality_id TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    lines TEXT NOT NULL, -- JSON array of strings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (day, personality_id, source_hash)
);
