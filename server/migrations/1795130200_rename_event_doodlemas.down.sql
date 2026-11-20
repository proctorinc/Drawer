UPDATE events SET name = 'Doodle-vember' WHERE slug = 'christmas-2026';

UPDATE achievements SET description = 'Draw your first doodle of Doodle-vember'
WHERE id = 'christmas-2026-first-snow';

UPDATE achievements SET description = 'Draw 12 doodles during Doodle-vember'
WHERE id = 'christmas-2026-twelve-days';

UPDATE ai_personalities SET bio = REPLACE(bio, 'Doodlemas', 'Doodle-vember') WHERE slug = 'santa';
