UPDATE daily_prompts SET judge_id = NULL WHERE judge_id = 'ai-union-elves';
DELETE FROM ai_reviews WHERE personality_id = 'ai-union-elves';
DELETE FROM ai_criteria WHERE personality_id = 'ai-union-elves';
DELETE FROM ai_personalities WHERE id = 'ai-union-elves';
