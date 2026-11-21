-- The judges are characters; the announcement doesn't need to call them AI
UPDATE announcements SET body = REPLACE(body, 'reviewed by an AI judge:', 'reviewed by a judge:') WHERE id = 'announce-ai-judges';
