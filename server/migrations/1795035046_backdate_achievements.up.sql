-- Fixing the achievement stat queries unlocked achievements people had earned long
-- before, all stamped with the day of the fix. Re-date each one to when the user
-- first reached its goal, counted the way the achievement checker counts. Dates only
-- ever move earlier, so running this again changes nothing.
WITH
-- A drawing's day is when it counts, even if it was uploaded later. Noon UTC keeps
-- that same date when shown in any time zone from UTC-12 to UTC+11.
submissions AS (
    SELECT user_id, day, datetime(day, '+12 hours') AS at,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day) AS n
    FROM user_submissions
),
-- Consecutive days share a run: the day minus its position is constant along a run
streaks AS (
    SELECT user_id, at,
        ROW_NUMBER() OVER (PARTITION BY user_id, julianday(day) - n ORDER BY day) AS n
    FROM submissions
),
friends AS (
    SELECT user1 AS user_id, created_at FROM friendships WHERE state = 'accepted'
    UNION ALL
    SELECT user2, created_at FROM friendships WHERE state = 'accepted'
),
reached (field, user_id, n, at) AS (
    SELECT 'SUBMISSION_TOTAL', user_id, n, at FROM submissions
    UNION ALL
    SELECT 'SUBMISSION_STREAK', user_id, n, at FROM streaks
    UNION ALL
    SELECT 'COMMENT_TOTAL', user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id), created_at
    FROM comments
    UNION ALL
    SELECT 'REACTION_TOTAL', user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id), created_at
    FROM reactions
    UNION ALL
    -- Invite time, since acceptance isn't recorded
    SELECT 'FRIEND_TOTAL', user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at), created_at
    FROM friends
),
earned AS (
    SELECT a.id AS achievement_id, r.user_id, datetime(MIN(r.at)) AS at
    FROM achievements a
    JOIN reached r ON r.field = a.achievement_field AND r.n = a.achievement_value
    GROUP BY a.id, r.user_id
)
UPDATE user_achievements
SET created_at = earned.at
FROM earned
WHERE earned.achievement_id = user_achievements.achievement_id
    AND earned.user_id = user_achievements.user_id
    AND earned.at < user_achievements.created_at;
