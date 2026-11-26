-- Drawing your own profile picture goes back to the 14-day streak.
UPDATE reward_unlocks SET achievement_id = COALESCE((
    SELECT a.id FROM achievements a
    LEFT JOIN event_achievements ea ON ea.achievement_id = a.id
    WHERE a.achievement_field = 'SUBMISSION_STREAK' AND a.achievement_value = 14 AND ea.achievement_id IS NULL
    ORDER BY a.id LIMIT 1
), achievement_id)
WHERE id = 'CUSTOM_PROFILE_PIC';
