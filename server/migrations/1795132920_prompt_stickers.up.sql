-- The sticker a prompt hands out for players to stick on their drawing before pinning it.
-- kind is one the app knows how to draw ("bubble", "googly-eyes"); size is how wide it
-- starts, as a percent of the canvas width.
CREATE TABLE prompt_stickers (
    day TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    size INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (day) REFERENCES daily_prompts (day) ON DELETE CASCADE
);
