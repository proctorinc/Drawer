-- Whose side a player took when a judge that scores backwards (the Grinch) asked them, in his
-- intro, to help ruin the day: joined (1) or refused (0), one answer per day. Kept with the
-- event it was asked in, so we can see who joined the Grinch during Doodlemas.
CREATE TABLE judge_pledges (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    personality_id TEXT NOT NULL,
    event_id TEXT,
    joined INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, day),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
