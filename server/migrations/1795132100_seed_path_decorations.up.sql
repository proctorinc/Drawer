-- Flair for the hard steps of a path that didn't unlock anything, showier the harder the
-- step: every path's far end now has something to wear. Each goes to the achievement that
-- counts that goal (doodling 100 times was added by hand, so it's found by its goal), and
-- only if that achievement exists and doesn't unlock something already.
-- Drawn by src/decorations/decorations.tsx.
WITH flair (id, name, description, field, goal) AS (VALUES
    ('PALETTE', 'Painter''s Palette', 'A palette floating by your head, for 100 doodles', 'SUBMISSION_TOTAL', 100),
    ('LAUREL_WREATH', 'Laurel Wreath', 'A laurel wreath for a whole month without a miss', 'SUBMISSION_STREAK', 30),
    ('BALLOONS', 'Balloons', 'A bunch of balloons, one for each of the crew', 'FRIEND_TOTAL', 10),
    ('QUILL', 'Critic''s Quill', 'A big feathered quill tucked behind your ear', 'COMMENT_TOTAL', 100),
    ('GOLD_STARS', 'Gold Stars', 'Five gold stars, one for each great score', 'AI_GREAT_TOTAL', 5),
    ('PLATINUM_PENCIL', 'Platinum Pencil', 'The pencil behind your ear, in platinum', 'LEVEL', 10)
)
INSERT OR IGNORE INTO reward_unlocks (id, name, description, achievement_id)
SELECT f.id, f.name, f.description, (
    SELECT a.id FROM achievements a
    LEFT JOIN event_achievements ea ON ea.achievement_id = a.id
    WHERE a.achievement_field = f.field AND a.achievement_value = f.goal AND ea.achievement_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM reward_unlocks r WHERE r.achievement_id = a.id)
    ORDER BY a.id LIMIT 1
)
FROM flair f
WHERE EXISTS (
    SELECT 1 FROM achievements a
    WHERE a.achievement_field = f.field AND a.achievement_value = f.goal
        AND NOT EXISTS (SELECT 1 FROM reward_unlocks r WHERE r.achievement_id = a.id)
);
