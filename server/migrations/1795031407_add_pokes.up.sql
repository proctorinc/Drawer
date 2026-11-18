-- One poke per friend per day, nudging someone who hasn't drawn yet
CREATE TABLE pokes (
    poker_id TEXT NOT NULL,
    pokee_id TEXT NOT NULL,
    day TEXT NOT NULL, -- YYYY-MM-DD
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poker_id, pokee_id, day),
    FOREIGN KEY (poker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pokee_id) REFERENCES users(id) ON DELETE CASCADE
);
