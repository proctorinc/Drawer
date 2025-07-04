-- Drop reactions table and indexes
DROP INDEX IF EXISTS idx_reactions_content;
DROP INDEX IF EXISTS idx_reactions_user;
DROP INDEX IF EXISTS idx_reactions_created_at;
DROP TABLE IF EXISTS reactions;