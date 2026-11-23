-- More to earn during Doodlemas, beyond its three stickers with flair: no decorations, just
-- ornaments and XP. Some are out in the open, some are secrets; the Grinch's are mostly
-- secret, and turn on whose side you took when he asked you to help ruin one of his days
-- (judge_pledges). A pledge only counts once it's locked in, by drawing that day's doodle.
-- Paths are "<event slug>:<what's counted>" like the other stickers, so the app can tell
-- which event a secret one belongs to while its details are hidden.
INSERT OR IGNORE INTO achievements (id, name, description, image_url, achievement_field, achievement_value, category, hidden, xp, path, path_step)
VALUES
    -- In the open
    ('christmas-2026-deck-the-halls', 'deck the halls', 'Give 25 festive reactions during Doodlemas', '', 'EVENT_REACTION_TOTAL', 25, 'events', 0, 40, 'christmas-2026:event_reaction_total', 1),
    ('christmas-2026-carol-singer', 'carol singer', 'Leave 10 comments during Doodlemas', '', 'EVENT_COMMENT_TOTAL', 10, 'events', 0, 40, 'christmas-2026:event_comment_total', 1),
    ('christmas-2026-jingle-bells', 'jingle bells', 'Get 10 festive reactions on your doodles during Doodlemas', '', 'EVENT_REACTION_RECEIVED_TOTAL', 10, 'events', 0, 40, 'christmas-2026:event_reaction_received_total', 1),
    ('christmas-2026-jingle-all-the-way', 'jingle all the way', 'Get 50 festive reactions on your doodles during Doodlemas', '', 'EVENT_REACTION_RECEIVED_TOTAL', 50, 'events', 0, 100, 'christmas-2026:event_reaction_received_total', 2),
    ('christmas-2026-snowed-in', 'snowed in', 'Doodle 7 days in a row during Doodlemas', '', 'EVENT_STREAK', 7, 'events', 0, 50, 'christmas-2026:event_streak', 1),
    -- Secrets, nothing to do with the Grinch
    ('christmas-2026-first-flake', 'the first flake', 'Doodle on the very first day of Doodlemas', '', 'EVENT_FIRST_DAY', 1, 'events', 1, 25, 'christmas-2026:event_first_day', 1),
    ('christmas-2026-night-before', 'the night before christmas', 'Doodle on Christmas Eve', '', 'EVENT_CHRISTMAS_EVE', 1, 'events', 1, 50, 'christmas-2026:event_christmas_eve', 1),
    ('christmas-2026-still-festive', 'still festive', 'Keep doodling on 3 days after Christmas, before Doodlemas wraps up', '', 'EVENT_AFTER_CHRISTMAS_TOTAL', 3, 'events', 1, 50, 'christmas-2026:event_after_christmas_total', 1),
    ('christmas-2026-secret-santa', 'secret santa', 'Send festive reactions to 5 different friends', '', 'EVENT_FRIENDS_CHEERED', 5, 'events', 1, 50, 'christmas-2026:event_friends_cheered', 1),
    -- The Grinch's. Turning him down once is the hint that there's more to it
    ('christmas-2026-grinch-refused', 'not today, grinch', 'Turn the Grinch down, then draw your doodle', '', 'GRINCH_REFUSED_TOTAL', 1, 'events', 0, 25, 'christmas-2026:grinch_refused_total', 1),
    ('christmas-2026-grinch-whoville', 'whoville''s finest', 'Turn the Grinch down on 4 of his days', '', 'GRINCH_REFUSED_TOTAL', 4, 'events', 1, 100, 'christmas-2026:grinch_refused_total', 2),
    ('christmas-2026-grinch-sworn-in', 'sworn in green', 'Join the Grinch''s plot', '', 'GRINCH_JOINED_TOTAL', 1, 'events', 1, 25, 'christmas-2026:grinch_joined_total', 1),
    ('christmas-2026-grinch-mean-one', 'a mean one', 'Join the Grinch on 4 of his days', '', 'GRINCH_JOINED_TOTAL', 4, 'events', 1, 100, 'christmas-2026:grinch_joined_total', 2),
    ('christmas-2026-grinch-change-of-heart', 'change of heart', 'Join the Grinch one day and turn him down on another', '', 'GRINCH_BOTH_SIDES', 1, 'events', 1, 50, 'christmas-2026:grinch_both_sides', 1),
    -- Every way a Grinch day can go: joined or refused him, then followed through (he
    -- scored you a 7 or more, the accomplice line) or went against him (a 3 or less)
    ('christmas-2026-grinch-loyalist', 'grinch loyalist', 'Join the Grinch, then draw badly enough to make him proud', '', 'GRINCH_LOYAL_TOTAL', 1, 'events', 1, 50, 'christmas-2026:grinch_loyal_total', 1),
    ('christmas-2026-grinch-right-hand', 'the grinch''s right hand', 'Join the Grinch and make him proud on 4 of his days', '', 'GRINCH_LOYAL_TOTAL', 4, 'events', 1, 150, 'christmas-2026:grinch_loyal_total', 2),
    ('christmas-2026-grinch-double-agent', 'double agent', 'Join the Grinch, then draw so well he scores you a 3 or less', '', 'GRINCH_DOUBLE_AGENT_TOTAL', 1, 'events', 1, 75, 'christmas-2026:grinch_double_agent_total', 1),
    ('christmas-2026-grinch-true-who', 'a true who', 'Turn the Grinch down, then draw so well he scores you a 3 or less', '', 'GRINCH_TRUE_WHO_TOTAL', 1, 'events', 1, 50, 'christmas-2026:grinch_true_who_total', 1),
    ('christmas-2026-grinch-all-talk', 'all talk', 'Turn the Grinch down, then draw badly enough to make him proud anyway', '', 'GRINCH_ALL_TALK_TOTAL', 1, 'events', 1, 50, 'christmas-2026:grinch_all_talk_total', 1);

INSERT OR IGNORE INTO event_achievements (achievement_id, event_id)
SELECT a.id, e.id FROM achievements a, events e
WHERE e.slug = 'christmas-2026' AND a.id IN (
    'christmas-2026-deck-the-halls', 'christmas-2026-carol-singer', 'christmas-2026-jingle-bells',
    'christmas-2026-jingle-all-the-way', 'christmas-2026-snowed-in', 'christmas-2026-first-flake',
    'christmas-2026-night-before', 'christmas-2026-still-festive', 'christmas-2026-secret-santa',
    'christmas-2026-grinch-refused', 'christmas-2026-grinch-whoville', 'christmas-2026-grinch-sworn-in',
    'christmas-2026-grinch-mean-one', 'christmas-2026-grinch-change-of-heart', 'christmas-2026-grinch-loyalist',
    'christmas-2026-grinch-right-hand', 'christmas-2026-grinch-double-agent',
    'christmas-2026-grinch-true-who', 'christmas-2026-grinch-all-talk'
);
