UPDATE users SET decoration = '' WHERE decoration = 'TURKEY_HAT';
DELETE FROM reward_unlocks WHERE id = 'TURKEY_HAT';
DELETE FROM user_achievements WHERE achievement_id = 'thanksgiving-doodle';
DELETE FROM achievements WHERE id = 'thanksgiving-doodle';
