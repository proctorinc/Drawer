-- Drawing your own profile picture now comes with the 5-day streak, not the 14-day one.
-- The streak achievements were added by hand, so the one to use is found by its goal. If
-- there's none, the reward stays where it is.
UPDATE reward_unlocks SET achievement_id = COALESCE((
    SELECT a.id FROM achievements a
    LEFT JOIN event_achievements ea ON ea.achievement_id = a.id
    WHERE a.achievement_field = 'SUBMISSION_STREAK' AND a.achievement_value = 5 AND ea.achievement_id IS NULL
    ORDER BY a.id LIMIT 1
), achievement_id)
WHERE id = 'CUSTOM_PROFILE_PIC';
