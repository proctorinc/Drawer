-- Redos: an admin lets a player draw a prompt they missed. A grant is for one particular day,
-- or (day NULL) for any day they missed since joining. Each is used up by one drawing.
CREATE TABLE redo_grants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    day TEXT,
    note TEXT NOT NULL DEFAULT '',
    granted_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    used_day TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_redo_grants_user ON redo_grants (user_id, used_at);

-- Drawn with a redo, after its prompt had closed. Whether these count toward streaks is the
-- redos_count_for_streaks app setting (off unless an admin turns it on).
ALTER TABLE user_submissions ADD COLUMN redo INTEGER NOT NULL DEFAULT 0;
