-- The Christmas event is now called Doodlemas
UPDATE events SET name = 'Doodlemas' WHERE slug = 'christmas-2026';

UPDATE achievements SET description = 'Draw your first doodle of Doodlemas'
WHERE id = 'christmas-2026-first-snow';

UPDATE achievements SET description = 'Draw 12 doodles during Doodlemas'
WHERE id = 'christmas-2026-twelve-days';

UPDATE ai_personalities SET bio = REPLACE(bio, 'Doodle-vember', 'Doodlemas') WHERE slug = 'santa';
