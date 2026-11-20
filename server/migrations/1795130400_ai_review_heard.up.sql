-- When the artist heard their judge's review (its dialogue played), so it counts as read
-- everywhere and never plays on its own twice
ALTER TABLE ai_reviews ADD COLUMN heard_at TIMESTAMP;
