-- Achievements are grouped into tabs on the achievements page, and secret ones keep
-- their name and goal hidden until they're earned.
ALTER TABLE achievements ADD COLUMN category TEXT NOT NULL DEFAULT 'drawing';
ALTER TABLE achievements ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
