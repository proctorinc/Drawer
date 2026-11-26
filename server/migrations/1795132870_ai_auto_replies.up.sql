-- A doodle's judge answers the first comment that @mentions it on its own, right away; later
-- mentions wait on the admin "ai mentions" page. A row claims a doodle's one automatic reply
-- while the judge writes it (replied_at NULL), and keeps it claimed once posted.
CREATE TABLE ai_auto_replies (
    submission_id TEXT PRIMARY KEY,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    replied_at TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES user_submissions (id) ON DELETE CASCADE
);
