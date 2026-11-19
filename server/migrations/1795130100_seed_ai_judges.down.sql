DELETE FROM ai_criteria WHERE personality_id IN ('ai-sir-doodleton', 'ai-professor-pickles', 'ai-santa');
DELETE FROM ai_personalities WHERE id IN ('ai-sir-doodleton', 'ai-professor-pickles', 'ai-santa');
DELETE FROM ai_settings WHERE key = 'enabled';
