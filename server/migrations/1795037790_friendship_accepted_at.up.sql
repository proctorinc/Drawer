-- When an invite was accepted, so the inviter can be told. Friendships accepted before
-- this have none.
ALTER TABLE friendships ADD COLUMN accepted_at TIMESTAMP;
