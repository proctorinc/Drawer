-- Limited-time events (e.g. holiday themes). Timestamps are stored as UTC
-- RFC3339 text ('YYYY-MM-DDTHH:MM:SSZ') so they compare correctly as strings.
-- An event is active while starts_at <= now < ends_at (ends_at is exclusive).
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    theme TEXT NOT NULL,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    countdown_days INTEGER, -- Optional length of a "day N of X" countdown, counted from starts_at
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_starts_at_ends_at ON events (starts_at, ends_at);

-- Nov 27 (day after US Thanksgiving) through Dec 25 is 29 days; the theme keeps running through Dec 31.
INSERT INTO events (id, slug, name, theme, starts_at, ends_at, countdown_days)
VALUES (lower(hex(randomblob(16))), 'christmas-2026', '29 Doodles of Christmas', 'christmas',
        '2026-11-27T00:00:00Z', '2027-01-01T00:00:00Z', 29);
