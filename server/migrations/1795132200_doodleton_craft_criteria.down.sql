UPDATE ai_criteria
SET description = 'How well it is drawn: confident lines, shapes, proportion, use of the palette. Would it survive a gallery wall?'
WHERE id = 'ai-sir-doodleton-skill'
  AND description = 'How well it''s drawn with one thick brush: clean, solid shapes, and detail finer than the brush itself, carved by layering colors or erasing back to the background.';

UPDATE ai_criteria
SET description = 'How the canvas is arranged: is the subject placed with intent, sized to fill the frame, every stroke deliberate and nothing wasted? Gallery-worthy, or a scrawl lost in a corner?'
WHERE id = 'ai-sir-doodleton-composition'
  AND description = 'How the canvas is used: a clear subject sized to fill it, everything placed so the scene reads, the background put to work, nothing cramped or stranded.';

UPDATE ai_criteria
SET description = 'How unmistakably it shows the prompt. Could a stranger name the prompt from the doodle alone?'
WHERE id = 'ai-sir-doodleton-recognizability'
  AND description = 'How clearly it shows the prompt, hints and clever readings included. Would a friend get it at a glance?';
