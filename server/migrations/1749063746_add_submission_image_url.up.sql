-- Write your up sql migration here-- Add image_url column to user_submissions table
ALTER TABLE user_submissions ADD COLUMN image_url TEXT NOT NULL DEFAULT '';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_submissions_image_url ON user_submissions (image_url); 