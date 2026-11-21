-- A stats start day restarts someone's progress: activity before it, a date on the
-- server's clock, earns no XP and counts toward no level, streak, quest or achievement.
-- Their drawings, comments and reactions stay. NULL, as for most people, counts it all.
ALTER TABLE users ADD COLUMN stats_start_day TEXT;

-- Achievements earned before a restart, kept so it can be undone
CREATE TABLE user_achievements_archive (
    achievement_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP,
    celebrated_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- matty_p starts from scratch on 2026-11-19
UPDATE users SET stats_start_day = '2026-11-19' WHERE id = '7ae9ca508a8fc36150eeb1fd6a69d174';

-- Whoever restarts earns their achievements (and the rewards they unlock) again, with
-- their celebrations, so archive and clear what they had, along with cached stats and
-- the last achievement check
INSERT INTO user_achievements_archive (achievement_id, user_id, created_at, celebrated_at)
SELECT achievement_id, user_id, created_at, celebrated_at FROM user_achievements
WHERE user_id IN (SELECT id FROM users WHERE stats_start_day IS NOT NULL);
DELETE FROM user_achievements
WHERE user_id IN (SELECT id FROM users WHERE stats_start_day IS NOT NULL);
DELETE FROM user_stat_calculations
WHERE user_id IN (SELECT id FROM users WHERE stats_start_day IS NOT NULL);
DELETE FROM user_achievement_checks
WHERE user_id IN (SELECT id FROM users WHERE stats_start_day IS NOT NULL);
