-- Sir Doodleton's criteria, described for a thick brush and four colors instead of a
-- gallery wall, and recognizability so hints and clever readings count. Only rewritten if an admin hasn't edited them since.
UPDATE ai_criteria
SET description = 'How well it''s drawn with one thick brush: clean, solid shapes, and detail finer than the brush itself, carved by layering colors or erasing back to the background.'
WHERE id = 'ai-sir-doodleton-skill'
  AND description = 'How well it is drawn: confident lines, shapes, proportion, use of the palette. Would it survive a gallery wall?';

UPDATE ai_criteria
SET description = 'How the canvas is used: a clear subject sized to fill it, everything placed so the scene reads, the background put to work, nothing cramped or stranded.'
WHERE id = 'ai-sir-doodleton-composition'
  AND description = 'How the canvas is arranged: is the subject placed with intent, sized to fill the frame, every stroke deliberate and nothing wasted? Gallery-worthy, or a scrawl lost in a corner?';

UPDATE ai_criteria
SET description = 'How clearly it shows the prompt, hints and clever readings included. Would a friend get it at a glance?'
WHERE id = 'ai-sir-doodleton-recognizability'
  AND description = 'How unmistakably it shows the prompt. Could a stranger name the prompt from the doodle alone?';
