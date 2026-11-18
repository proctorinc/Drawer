DELETE FROM user_achievements WHERE achievement_id IN (SELECT achievement_id FROM event_achievements);
DELETE FROM achievements WHERE id IN (SELECT achievement_id FROM event_achievements);
DROP INDEX IF EXISTS idx_event_achievements_event_id;
DROP TABLE IF EXISTS event_achievements;
DROP TABLE IF EXISTS event_reactions;
DROP TABLE IF EXISTS event_notifications_sent;
