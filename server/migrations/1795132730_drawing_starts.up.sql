-- A doodle left unfinished when the prompt rolls over can still be pinned the next day, but only
-- if it was started while its prompt was live. The app records the first stroke of each day's
-- doodle here; the drawing itself stays on the device.
CREATE TABLE drawing_starts (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, day),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Pinned the day after its prompt, so it can say so
ALTER TABLE user_submissions ADD COLUMN late INTEGER NOT NULL DEFAULT 0;
