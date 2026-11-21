UPDATE announcements SET body = REPLACE(body, 'reviewed by a judge:', 'reviewed by an AI judge:') WHERE id = 'announce-ai-judges';
