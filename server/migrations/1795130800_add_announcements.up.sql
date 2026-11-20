-- Announcements: full-screen "what's new" pages shown once to each player when they next open
-- the app (new features, events, …), and again on request from the notifications menu.
-- A player sees the active ones whose window covers now (starts_at <= now < expires_at), so
-- someone coming back after a year gets only what's still relevant. Times are UTC RFC3339 text.
-- art picks a picture the app knows how to draw ('none', 'ai_judges', 'christmas' or 'image',
-- which shows image_url). cta_url is an in-app path or an https link. Lower position shows first.
CREATE TABLE announcements (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', art TEXT NOT NULL DEFAULT 'none', image_url TEXT NOT NULL DEFAULT '', cta_label TEXT NOT NULL DEFAULT '', cta_url TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 0, starts_at TIMESTAMP NOT NULL, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_announcements_window ON announcements (active, starts_at, expires_at);

-- Who has seen which announcement, so it never pops up for them on its own again
CREATE TABLE announcement_views (user_id TEXT NOT NULL, announcement_id TEXT NOT NULL, seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, announcement_id), FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE);
CREATE INDEX idx_announcement_views_announcement_id ON announcement_views (announcement_id);
