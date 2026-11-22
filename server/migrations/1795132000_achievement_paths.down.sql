DROP INDEX IF EXISTS idx_achievements_path;
UPDATE achievements SET xp = 25;
ALTER TABLE achievements DROP COLUMN path_step;
ALTER TABLE achievements DROP COLUMN path;
