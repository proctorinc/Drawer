UPDATE users SET decoration = '' WHERE decoration = 'GRINCH_HEART';
DELETE FROM reward_unlocks WHERE id = 'GRINCH_HEART';
DELETE FROM user_achievements WHERE achievement_id IN ('grinch-zero', 'grinch-side');
DELETE FROM achievements WHERE id IN ('grinch-zero', 'grinch-side');
UPDATE daily_prompts SET judge_id = NULL WHERE judge_id = 'ai-grinch';
DELETE FROM ai_reviews WHERE personality_id = 'ai-grinch';
DELETE FROM ai_criteria WHERE personality_id = 'ai-grinch';
DELETE FROM ai_personalities WHERE id = 'ai-grinch';
