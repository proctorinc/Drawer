-- Reaction ids that are only allowed while their event is active (e.g. christmas snowflakes).
CREATE TABLE event_reactions (
    event_id TEXT NOT NULL,
    reaction_id TEXT NOT NULL,
    PRIMARY KEY (event_id, reaction_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Links an achievement ("sticker") to an event. Its achievement_field then counts only
-- submissions inside that event's window.
CREATE TABLE event_achievements (
    achievement_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX idx_event_achievements_event_id ON event_achievements (event_id);

-- One row per event broadcast already sent (kind: 'start', 'countdown_end', 'end'), so a
-- restart or a second instance never sends it again.
CREATE TABLE event_notifications_sent (
    event_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, kind),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

INSERT INTO event_reactions (event_id, reaction_id)
SELECT id, reaction_id FROM events, (SELECT 'snowflake' AS reaction_id UNION ALL SELECT 'gift')
WHERE slug = 'christmas-2026';

INSERT INTO achievements (id, name, description, image_url, achievement_field, achievement_value)
VALUES
    ('christmas-2026-first-snow', 'first snow', 'Draw your first doodle of the 29 Doodles of Christmas', '', 'EVENT_SUBMISSION_TOTAL', 1),
    ('christmas-2026-twelve-days', 'twelve days of doodles', 'Draw 12 doodles during the 29 Doodles of Christmas', '', 'EVENT_SUBMISSION_TOTAL', 12),
    ('christmas-2026-doodle-claus', 'doodle claus', 'Doodle every day from Nov 27 to Dec 25', '', 'EVENT_COUNTDOWN_TOTAL', 29);

INSERT INTO event_achievements (achievement_id, event_id)
SELECT a.id, e.id FROM achievements a, events e
WHERE e.slug = 'christmas-2026'
  AND a.id IN ('christmas-2026-first-snow', 'christmas-2026-twelve-days', 'christmas-2026-doodle-claus');
