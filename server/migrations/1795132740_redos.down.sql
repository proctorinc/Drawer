ALTER TABLE user_submissions DROP COLUMN redo;
DROP INDEX idx_redo_grants_user;
DROP TABLE redo_grants;
