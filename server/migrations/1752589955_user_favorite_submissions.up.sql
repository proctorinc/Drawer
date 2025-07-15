-- Write your up sql migration here
CREATE TABLE IF NOT EXISTS user_favorite_submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    submission_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    order_num INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (submission_id) REFERENCES user_submissions(id),
    UNIQUE(user_id, submission_id)
);