-- The beta zone: features tried out with a few people before everyone gets them.
-- Admins always have access; anyone else needs a row here.
CREATE TABLE beta_testers (
    user_id TEXT PRIMARY KEY,
    added_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sketch duels: two players take turns drawing a secret prompt in a minute
-- while the other guesses it in three tries, scored by the AI.
-- Round 1: the challenger draws, the opponent guesses. Round 2: the other way round.
CREATE TABLE duels (
    id TEXT PRIMARY KEY,
    challenger_id TEXT NOT NULL,
    opponent_id TEXT NOT NULL,
    -- active, done, expired (someone never played their turn), cancelled
    status TEXT NOT NULL DEFAULT 'active',
    -- The AI judge who hosts it (the day's judge when it started), or '' for the stock host
    host_id TEXT NOT NULL DEFAULT '',
    -- The AI host's closing words, once it's done
    summary TEXT NOT NULL DEFAULT '',
    -- When whoever's turn it is was last reminded, so reminders go out once
    reminded_at TIMESTAMP,
    -- Each player's last look at the duel, so the other can see they're here right now
    challenger_seen_at TIMESTAMP,
    opponent_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- When the duel last moved on: the clock reminders and expiry run from
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    FOREIGN KEY (challenger_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_duels_challenger ON duels(challenger_id);
CREATE INDEX idx_duels_opponent ON duels(opponent_id);
CREATE INDEX idx_duels_status ON duels(status);

CREATE TABLE duel_rounds (
    duel_id TEXT NOT NULL,
    round INTEGER NOT NULL, -- 1 or 2
    drawer_id TEXT NOT NULL,
    guesser_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    keywords TEXT NOT NULL, -- JSON array of the words the guess is scored on
    -- The prompt is only shown once the drawer starts their minute
    draw_started_at TIMESTAMP,
    -- The drawing, as a data:image/png URL
    image TEXT,
    drawn_at TIMESTAMP,
    -- The best of the guesses, 0..100, once guessing is over
    score INTEGER,
    finished_at TIMESTAMP,
    PRIMARY KEY (duel_id, round),
    FOREIGN KEY (duel_id) REFERENCES duels(id) ON DELETE CASCADE
);

CREATE TABLE duel_guesses (
    duel_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    attempt INTEGER NOT NULL, -- 1..3
    guess TEXT NOT NULL,
    score INTEGER NOT NULL, -- 0..100
    exact INTEGER NOT NULL DEFAULT 0,
    -- JSON: how each word of the guess and each keyword of the prompt fared
    feedback TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (duel_id, round, attempt),
    FOREIGN KEY (duel_id, round) REFERENCES duel_rounds(duel_id, round) ON DELETE CASCADE
);
