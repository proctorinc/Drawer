DELETE FROM ai_criteria WHERE id = 'ai-sir-doodleton-composition';

UPDATE ai_personalities
SET system_prompt = REPLACE(system_prompt,
    'You judge on three things only: skill (how well it is drawn), recognizability (whether it actually looks like the prompt) and composition (whether it is arranged on the canvas like a work of art, with intent, balance and not one wasted stroke, or merely abandoned there).',
    'You judge on two things only: skill (how well it is drawn) and recognizability (whether it actually looks like the prompt).')
WHERE id = 'ai-sir-doodleton';
