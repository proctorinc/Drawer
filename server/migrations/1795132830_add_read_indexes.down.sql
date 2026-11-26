DROP INDEX idx_reactions_content_id;
CREATE INDEX idx_reactions_content ON reactions (content_type, content_id);

DROP INDEX idx_pokes_pokee_id_created_at;
DROP INDEX idx_comments_created_at;
DROP INDEX idx_comments_user_id_created_at;
DROP INDEX idx_comments_submission_id;
