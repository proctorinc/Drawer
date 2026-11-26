-- Turso bills rows read, so the hot paths (activity bell, feed, trophies) need indexes
-- instead of table scans.
CREATE INDEX idx_comments_submission_id ON comments (submission_id);
CREATE INDEX idx_comments_user_id_created_at ON comments (user_id, created_at);
CREATE INDEX idx_comments_created_at ON comments (created_at);
CREATE INDEX idx_pokes_pokee_id_created_at ON pokes (pokee_id, created_at);

-- content_type has two values, so leading with it made SQLite walk half the reactions table
-- for every lookup. Leading with content_id makes each lookup touch only that content's rows.
DROP INDEX idx_reactions_content;
CREATE INDEX idx_reactions_content_id ON reactions (content_id, content_type);
