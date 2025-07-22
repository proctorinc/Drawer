-- 1. Rename the current table for backup
ALTER TABLE friendships RENAME TO friendships_new;

-- 2. Recreate the old friendships table
CREATE TABLE friendships (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, friend_id)
);

-- 3. Migrate data back, splitting user1/user2 into user_id/friend_id (ignore inviter_id)
INSERT INTO friendships (user_id, friend_id, created_at)
SELECT user1, user2, created_at FROM friendships_new;

-- 4. Drop the new table
DROP TABLE friendships_new;

-- 5. Recreate indexes if needed
CREATE INDEX idx_friendships_user ON friendships (user_id);
CREATE INDEX idx_friendships_friend ON friendships (friend_id);