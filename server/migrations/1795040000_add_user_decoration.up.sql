-- The decoration a user wears on their avatar: a reward_unlocks id, or '' for none
ALTER TABLE users ADD COLUMN decoration TEXT NOT NULL DEFAULT '';
