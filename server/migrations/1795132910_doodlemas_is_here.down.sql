UPDATE announcements SET active = 1 WHERE id = 'announce-ai-judges';

UPDATE announcements
SET title = 'something festive is coming',
    body = 'Doodlemas starts November 27. Keep your pencils sharp.',
    cta_label = '',
    cta_url = '',
    starts_at = '2026-11-20T00:00:00Z'
WHERE id = 'announce-doodlemas';
