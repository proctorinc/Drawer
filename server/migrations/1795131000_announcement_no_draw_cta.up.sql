-- The AI judges announcement shouldn't send people off to draw: drop its button
UPDATE announcements SET cta_label = '', cta_url = '' WHERE id = 'announce-ai-judges';
