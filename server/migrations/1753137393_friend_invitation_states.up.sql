-- 1. Rename the old table for backup
ALTER TABLE friendships RENAME TO friendships_old;

-- 2. Create the new friendships table with user1, user2, state, and inviter_id
CREATE TABLE friendships (
    user1 TEXT NOT NULL,
    user2 TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending', 'accepted')) DEFAULT 'pending',
    inviter_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user1, user2)
);

-- 3. Migrate data from old table to new table, enforcing user1 > user2 and setting state to 'accepted', inviter_id to user1
INSERT INTO friendships (user1, user2, state, inviter_id, created_at)
SELECT
    CASE WHEN user_id > friend_id THEN user_id ELSE friend_id END AS user1,
    CASE WHEN user_id < friend_id THEN user_id ELSE friend_id END AS user2,
    'accepted' AS state,
    CASE WHEN user_id > friend_id THEN user_id ELSE friend_id END AS inviter_id,
    MIN(created_at) as created_at
FROM friendships_old
WHERE user_id != friend_id
GROUP BY user1, user2;

-- 4. Drop the old table
DROP TABLE friendships_old;

-- 5. Recreate indexes if needed
CREATE INDEX idx_friendships_user1 ON friendships (user1);
CREATE INDEX idx_friendships_user2 ON friendships (user2);
CREATE INDEX idx_friendships_state ON friendships (state);
CREATE INDEX idx_friendships_inviter_id ON friendships (inviter_id);