-- Drop tables in correct order (dependent tables first)
DROP TABLE IF EXISTS verification_tokens;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS user_submissions;
DROP TABLE IF EXISTS daily_prompts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS schema_migrations;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS activity_reads;
DROP TABLE IF EXISTS user_favorite_submissions;
