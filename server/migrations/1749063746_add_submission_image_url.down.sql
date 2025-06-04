-- Drop the index first
DROP INDEX IF EXISTS idx_user_submissions_image_url;

-- Remove the image_url column
ALTER TABLE user_submissions DROP COLUMN image_url;
