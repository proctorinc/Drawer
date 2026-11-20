-- The first announcements: the AI judges, and a teaser for Doodlemas (it starts Nov 27)
INSERT OR IGNORE INTO announcements (id, title, body, art, cta_label, cta_url, position, active, starts_at, expires_at)
VALUES
    ('announce-ai-judges', 'meet the judges',
     'Every doodle you post now gets reviewed by an AI judge: a score out of 10 and a comment. Fair warning, they''re tough critics.

You''ll see who''s judging today on the drawing page, and their verdicts land in your notifications.',
     'ai_judges', 'draw something', '/draw', 0, 1, '2026-11-20T00:00:00Z', '2027-01-15T00:00:00Z'),
    ('announce-doodlemas', 'something festive is coming',
     'Doodlemas starts November 27. Keep your pencils sharp.',
     'christmas', '', '', 1, 1, '2026-11-20T00:00:00Z', '2027-01-01T00:00:00Z');
