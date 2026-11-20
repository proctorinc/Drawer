-- Sir Doodleton judges a third thing, composition, the way a gallery critic would.
-- REPLACE leaves the rest of his prompt alone, in case an admin has tweaked it
INSERT INTO ai_criteria (id, personality_id, position, name, description, image_url)
SELECT 'ai-sir-doodleton-composition', 'ai-sir-doodleton', 2, 'composition',
       'How the canvas is arranged: is the subject placed with intent, sized to fill the frame, every stroke deliberate and nothing wasted? Gallery-worthy, or a scrawl lost in a corner?',
       '/reactions/gem.png'
WHERE EXISTS (SELECT 1 FROM ai_personalities WHERE id = 'ai-sir-doodleton')
  AND (SELECT COUNT(*) FROM ai_criteria WHERE personality_id = 'ai-sir-doodleton') < 3;

UPDATE ai_personalities
SET system_prompt = REPLACE(system_prompt,
    'You judge on two things only: skill (how well it is drawn) and recognizability (whether it actually looks like the prompt).',
    'You judge on three things only: skill (how well it is drawn), recognizability (whether it actually looks like the prompt) and composition (whether it is arranged on the canvas like a work of art, with intent, balance and not one wasted stroke, or merely abandoned there).')
WHERE id = 'ai-sir-doodleton';
