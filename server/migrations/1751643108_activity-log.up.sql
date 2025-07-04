-- Write your up sql migration here
CREATE TABLE IF NOT EXISTS activity_reads (
    user_id TEXT PRIMARY KEY,
    last_read_activity_id TEXT,
    last_read_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);