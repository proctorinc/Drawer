-- Achievements line up in paths: each step leads to the next (3 days in a row, then 14,
-- then 30...), each worth more than the last. Only the first step you haven't completed is current, so it alone shows up
-- next and pings its progress; the rest wait their turn. Achievements sharing a path are
-- its steps in path_step order; one with no path is a path of its own.
ALTER TABLE achievements ADD COLUMN path TEXT;
ALTER TABLE achievements ADD COLUMN path_step INTEGER NOT NULL DEFAULT 1;

-- Start with one path per thing counted (an event's stickers on their own), stepping up
-- by goal
UPDATE achievements SET path = COALESCE((
    SELECT e.slug || ':' FROM event_achievements ea JOIN events e ON e.id = ea.event_id
    WHERE ea.achievement_id = achievements.id
), '') || lower(achievement_field);

UPDATE achievements SET path_step = (
    SELECT COUNT(*) FROM achievements b
    WHERE b.path = achievements.path
        AND (b.achievement_value < achievements.achievement_value
            OR (b.achievement_value = achievements.achievement_value AND b.id <= achievements.id))
);

-- What each is worth, by how hard it really is to get, next to the 10 XP a doodle earns.
-- One doodle a day is the pace, so a streak is far harder than the same number of doodles,
-- and a goal that needs friends (reactions, laughs) or luck (a 10, a picked prompt) is
-- worth more than its number suggests. Every path climbs, and steeply at its far end.
-- Matched on what's counted and the goal, so achievements added by hand are tuned too;
-- anything not listed stays at 25.
WITH tuning (field, goal, xp) AS (VALUES
    -- One doodle a day: the goal is roughly days of drawing
    ('SUBMISSION_TOTAL', 1, 10),
    ('SUBMISSION_TOTAL', 10, 30),
    ('SUBMISSION_TOTAL', 25, 60),
    ('SUBMISSION_TOTAL', 50, 100),
    ('SUBMISSION_TOTAL', 100, 175),
    ('SUBMISSION_TOTAL', 250, 350),
    ('SUBMISSION_TOTAL', 365, 500),
    ('FAVORITE_TOTAL', 3, 15),
    -- Every day without a miss: one slip starts it over
    ('SUBMISSION_STREAK', 3, 20),
    ('SUBMISSION_STREAK', 5, 40),
    ('SUBMISSION_STREAK', 14, 100),
    ('SUBMISSION_STREAK', 30, 225),
    ('SUBMISSION_STREAK', 100, 750),
    -- Friends are hard to come by in a small app
    ('FRIEND_TOTAL', 1, 15),
    ('FRIEND_TOTAL', 5, 50),
    ('FRIEND_TOTAL', 10, 125),
    ('COMMENT_TOTAL', 1, 10),
    ('COMMENT_TOTAL', 25, 50),
    ('COMMENT_TOTAL', 100, 150),
    -- A tap each
    ('REACTION_TOTAL', 1, 10),
    ('REACTION_TOTAL', 100, 75),
    -- Up to your friends, not you
    ('REACTION_RECEIVED_TOTAL', 50, 60),
    ('REACTION_RECEIVED_TOTAL', 250, 200),
    ('CRY_LAUGH_RECEIVED_TOTAL', 10, 80),
    ('POKE_TOTAL', 1, 10),
    ('PROMPT_PICKED_TOTAL', 1, 100),
    -- The judges: a 10 is rare, and five 8s takes real skill
    ('AI_REVIEW_TOTAL', 1, 10),
    ('AI_REVIEW_TOTAL', 25, 60),
    ('AI_BEST_SCORE', 8, 50),
    ('AI_BEST_SCORE', 9, 125),
    ('AI_BEST_SCORE', 10, 350),
    ('AI_GREAT_TOTAL', 5, 150),
    ('AI_LOW_TOTAL', 1, 30),
    ('AI_JUDGES_MET', 3, 40),
    -- Levels get slower to climb (level n to n+1 costs 50n XP)
    ('LEVEL', 5, 50),
    ('LEVEL', 10, 100),
    ('LEVEL', 20, 250),
    ('LEVEL', 30, 400),
    -- Events: doodle claus is every day of the countdown
    ('EVENT_SUBMISSION_TOTAL', 1, 15),
    ('EVENT_SUBMISSION_TOTAL', 12, 100),
    ('EVENT_COUNTDOWN_TOTAL', 29, 400)
)
UPDATE achievements SET xp = (
    SELECT t.xp FROM tuning t
    WHERE t.field = achievements.achievement_field AND t.goal = achievements.achievement_value
)
WHERE EXISTS (
    SELECT 1 FROM tuning t
    WHERE t.field = achievements.achievement_field AND t.goal = achievements.achievement_value
);

CREATE INDEX idx_achievements_path ON achievements (path, path_step);
