-- Doodlemas has started: retire the judges intro and turn the teaser into the real thing.
-- Clearing the teaser's views pops it up again for everyone who already saw it.
UPDATE announcements SET active = 0 WHERE id = 'announce-ai-judges';

UPDATE announcements
SET title = 'doodlemas is here',
    body = 'A doodle a day counting down to Christmas, and every one hangs on your tree as an ornament. Santa''s judging, everyone gets a Santa hat, and there are festive stickers to win and slap on friends'' doodles.

Oh, and don''t feed the Grinch.',
    cta_label = 'see my tree',
    cta_url = '/draw/event/christmas-2026',
    starts_at = '2026-11-27T00:00:00Z'
WHERE id = 'announce-doodlemas';

DELETE FROM announcement_views WHERE announcement_id = 'announce-doodlemas';
