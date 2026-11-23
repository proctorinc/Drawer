-- The last of the Grinch's Doodlemas achievements: see every one of his days through, picking
-- a side each time (either side, any mix) and drawing that day's doodle. Out in the open, and
-- the only one of his with flair: his own scruffy hat, to keep. On Grinch days the app also
-- puts it on everyone who joined him, for the day.
INSERT OR IGNORE INTO achievements (id, name, description, image_url, achievement_field, achievement_value, category, hidden, xp, path, path_step)
VALUES ('christmas-2026-grinch-season', 'grinch season', 'Pick a side on all 5 Grinch days, either side, and draw each doodle', '', 'GRINCH_DAYS_TOTAL', 5, 'events', 0, 150, 'christmas-2026:grinch_days_total', 1);

INSERT OR IGNORE INTO event_achievements (achievement_id, event_id)
SELECT 'christmas-2026-grinch-season', id FROM events WHERE slug = 'christmas-2026';

INSERT OR IGNORE INTO reward_unlocks (id, name, description, achievement_id)
VALUES ('GRINCH_HAT', 'The Grinch''s Hat', 'His droopy, moth-eaten hat, for seeing every one of his days through', 'christmas-2026-grinch-season');
