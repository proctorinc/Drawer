-- Up to three drawn faces per user. users.avatar_url stays the face being worn,
-- a copy of one of these slots, so nothing that shows avatars has to change
CREATE TABLE user_avatars (user_id TEXT NOT NULL, slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 2), url TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, slot), FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE);

-- Everyone's existing drawing becomes their first slot
INSERT INTO user_avatars (user_id, slot, url)
SELECT id, 0, avatar_url FROM users WHERE avatar_url != '';
