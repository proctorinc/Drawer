-- App-wide settings admins choose for everyone, e.g. which sound the pencils make.
-- Kept apart from ai_settings, which holds secrets.
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
