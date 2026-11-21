-- What earning each achievement or sticker is worth. Every one starts at the flat 25 they
-- were all worth before, so nobody's XP changes until one is retuned.
ALTER TABLE achievements ADD COLUMN xp INTEGER NOT NULL DEFAULT 25;
