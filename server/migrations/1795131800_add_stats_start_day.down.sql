-- Put back the achievements a restart archived, over any earned again since
INSERT OR REPLACE INTO user_achievements (achievement_id, user_id, created_at, celebrated_at)
SELECT achievement_id, user_id, created_at, celebrated_at FROM user_achievements_archive;
DROP TABLE IF EXISTS user_achievements_archive;
DELETE FROM user_stat_calculations
WHERE user_id IN (SELECT id FROM users WHERE stats_start_day IS NOT NULL);
ALTER TABLE users DROP COLUMN stats_start_day;
