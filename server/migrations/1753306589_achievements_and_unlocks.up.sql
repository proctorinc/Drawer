CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    image_url TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    achievement_field TEXT NOT NULL,
    achievement_value INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reward_unlocks (
    id TEXT PRIMARY KEY, -- NOT UUID, HARDCODED CUSTOM STRING
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    achievement_id TEXT,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

CREATE TABLE IF NOT EXISTS user_achievements (
    achievement_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id),
    UNIQUE(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_achievement_checks (
    user_id TEXT NOT NULL UNIQUE,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_stat_calculations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stat_type TEXT NOT NULL,
    stat_value INTEGER NOT NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_user_id_achievement_id ON user_achievements(user_id, achievement_id);
CREATE INDEX idx_reward_unlocks_achievement_id ON reward_unlocks(achievement_id);
CREATE INDEX idx_user_stat_calculations_user_id ON user_stat_calculations(user_id);
CREATE INDEX idx_user_stat_calculations_stat_type ON user_stat_calculations(stat_type);
CREATE INDEX idx_user_stat_updates_user_id ON user_stat_calculations(user_id);
CREATE INDEX idx_user_stat_updates_stat_type ON user_stat_calculations(stat_type);
