-- Sort the existing achievements into their tabs (the rest stay in drawing)
UPDATE achievements SET category = 'streaks' WHERE achievement_field = 'SUBMISSION_STREAK';
UPDATE achievements SET category = 'friends'
WHERE achievement_field IN ('COMMENT_TOTAL', 'REACTION_TOTAL', 'FRIEND_TOTAL');
UPDATE achievements SET category = 'events'
WHERE id IN (SELECT achievement_id FROM event_achievements);

-- More to collect. Hidden ones show as a mystery until earned. The art is bundled in
-- src/assets/badges, named after the field and goal.
INSERT OR IGNORE INTO achievements (id, name, description, image_url, achievement_field, achievement_value, category, hidden)
VALUES
    -- drawing
    ('doodle-25', 'quarter century', 'Draw 25 doodles', '', 'SUBMISSION_TOTAL', 25, 'drawing', 0),
    ('doodle-250', 'sketchbook hoarder', 'Draw 250 doodles', '', 'SUBMISSION_TOTAL', 250, 'drawing', 0),
    ('doodle-365', 'a year in ink', 'Draw 365 doodles', '', 'SUBMISSION_TOTAL', 365, 'drawing', 1),
    ('pinned-3', 'gallery wall', 'Pin 3 doodles to your book', '', 'FAVORITE_TOTAL', 3, 'drawing', 0),
    -- streaks
    ('streak-3', 'warming up', 'Doodle 3 days in a row', '', 'SUBMISSION_STREAK', 3, 'streaks', 0),
    ('streak-14', 'two weeks strong', 'Doodle 14 days in a row', '', 'SUBMISSION_STREAK', 14, 'streaks', 0),
    ('streak-30', 'monthly regular', 'Doodle 30 days in a row', '', 'SUBMISSION_STREAK', 30, 'streaks', 0),
    ('streak-100', 'unstoppable', 'Doodle 100 days in a row', '', 'SUBMISSION_STREAK', 100, 'streaks', 1),
    -- friends
    ('friend-1', 'plus one', 'Make your first friend', '', 'FRIEND_TOTAL', 1, 'friends', 0),
    ('friend-10', 'the whole crew', 'Make 10 friends', '', 'FRIEND_TOTAL', 10, 'friends', 0),
    ('comment-25', 'chatterbox', 'Leave 25 comments', '', 'COMMENT_TOTAL', 25, 'friends', 0),
    ('comment-100', 'art critic', 'Leave 100 comments', '', 'COMMENT_TOTAL', 100, 'friends', 0),
    ('reaction-100', 'hype machine', 'React 100 times', '', 'REACTION_TOTAL', 100, 'friends', 0),
    ('reactions-received-50', 'crowd pleaser', 'Get 50 reactions from friends', '', 'REACTION_RECEIVED_TOTAL', 50, 'friends', 0),
    ('reactions-received-250', 'fan favorite', 'Get 250 reactions from friends', '', 'REACTION_RECEIVED_TOTAL', 250, 'friends', 0),
    ('cry-laughs-10', 'class clown', 'Make friends cry-laugh 10 times', '', 'CRY_LAUGH_RECEIVED_TOTAL', 10, 'friends', 1),
    ('poke-1', 'poke!', 'Poke a friend who hasn''t doodled yet', '', 'POKE_TOTAL', 1, 'friends', 1),
    ('prompt-picked-1', 'ideas person', 'Suggest a prompt that becomes the daily prompt', '', 'PROMPT_PICKED_TOTAL', 1, 'friends', 1),
    -- AI judges
    ('judged-1', 'first critique', 'Get your first review from a judge', '', 'AI_REVIEW_TOTAL', 1, 'judges', 0),
    ('judged-25', 'thick skin', 'Get 25 reviews from the judges', '', 'AI_REVIEW_TOTAL', 25, 'judges', 0),
    ('judge-best-8', 'teacher''s pet', 'Score 8 or more with a judge', '', 'AI_BEST_SCORE', 8, 'judges', 0),
    ('judge-best-9', 'gallery worthy', 'Score 9 or more with a judge', '', 'AI_BEST_SCORE', 9, 'judges', 0),
    ('judge-great-5', 'consistently great', 'Score 8 or more on 5 doodles', '', 'AI_GREAT_TOTAL', 5, 'judges', 0),
    ('judge-best-10', 'perfect ten', 'Score a perfect 10 with a judge', '', 'AI_BEST_SCORE', 10, 'judges', 1),
    ('judge-low-1', 'abstract period', 'Score under 2 with a judge', '', 'AI_LOW_TOTAL', 1, 'judges', 1),
    ('judges-met-3', 'met the panel', 'Get reviewed by 3 different judges', '', 'AI_JUDGES_MET', 3, 'judges', 1),
    -- levels
    ('level-5', 'silver lining', 'Reach level 5', '', 'LEVEL', 5, 'levels', 0),
    ('level-10', 'platinum pencil', 'Reach level 10', '', 'LEVEL', 10, 'levels', 0),
    ('level-20', 'grandmaster', 'Reach level 20', '', 'LEVEL', 20, 'levels', 0),
    ('level-30', 'mythic', 'Reach level 30', '', 'LEVEL', 30, 'levels', 1);

-- Hand out the new ones people already qualify for, dated to when they got there (see
-- 1795035046_backdate_achievements), so they don't all land in the feed today. The rest
-- (judges, levels, reactions received...) are handed out the next time the app checks.
WITH
submissions AS (
    SELECT user_id, day, datetime(day, '+12 hours') AS at,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day) AS n
    FROM user_submissions
),
streaks AS (
    SELECT user_id, at,
        ROW_NUMBER() OVER (PARTITION BY user_id, julianday(day) - n ORDER BY day) AS n
    FROM submissions
),
friends AS (
    SELECT user1 AS user_id, COALESCE(accepted_at, created_at) AS created_at FROM friendships WHERE state = 'accepted'
    UNION ALL
    SELECT user2, COALESCE(accepted_at, created_at) FROM friendships WHERE state = 'accepted'
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
    SELECT 'FRIEND_TOTAL', user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at), created_at
    FROM friends
)
INSERT OR IGNORE INTO user_achievements (achievement_id, user_id, created_at)
SELECT a.id, r.user_id, datetime(MIN(r.at))
FROM achievements a
JOIN reached r ON r.field = a.achievement_field AND r.n = a.achievement_value
JOIN users u ON u.id = r.user_id
WHERE a.id IN ('doodle-25', 'doodle-250', 'doodle-365', 'streak-3', 'streak-14', 'streak-30', 'streak-100',
    'friend-1', 'friend-10', 'comment-25', 'comment-100', 'reaction-100')
GROUP BY a.id, r.user_id;
