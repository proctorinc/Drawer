-- The sketch face an admin picked for a user, in place of the one their id gives them.
-- face is "look/hair/neckline/glasses/extra", e.g. "masc/crop/crew/none/beard"
CREATE TABLE avatar_faces (
    user_id TEXT PRIMARY KEY,
    face TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
