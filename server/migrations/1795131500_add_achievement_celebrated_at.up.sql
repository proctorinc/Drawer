-- When the player was shown the celebration for an achievement or sticker. NULL means it
-- hasn't played yet, on any device. Everything earned before this column existed counts as
-- already celebrated, so nobody gets a flood of replays.
ALTER TABLE user_achievements ADD COLUMN celebrated_at TIMESTAMP;
UPDATE user_achievements SET celebrated_at = created_at;
