-- How many letters a prompt's word bubble holds, set per prompt by admins. Only word
-- bubbles hold words: other stickers keep 0. Bubbles already out keep the 10 the app had.
ALTER TABLE prompt_stickers ADD COLUMN max_chars INTEGER NOT NULL DEFAULT 0;
UPDATE prompt_stickers SET max_chars = 10 WHERE kind = 'bubble';
