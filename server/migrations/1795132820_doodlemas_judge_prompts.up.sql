-- Doodlemas prompts that fit the judge of their day:
-- - The Union Elves' days are about a job, so there's work to show
-- - On Santa's, someone gets rescued or reunited, for a good deed and a happy ending
-- - The Grinch's are all things he can't stand (tinsel, noise, feasts, carols, presents), so
--   drawing it well and cheerful is plainly defying him
-- Displaced prompts move to a day whose judge they suit. Each change only happens if the
-- day still has its original prompt, so an admin's edit is never overwritten.
UPDATE daily_prompts SET prompt = CASE day
        -- The Union Elves
        WHEN '2026-11-28' THEN 'a snowman''s first day on the job'
        WHEN '2026-11-30' THEN 'a gingerbread house behind schedule'
        WHEN '2026-12-03' THEN 'an elf on strike'
        WHEN '2026-12-08' THEN 'delivering a present that''s way too big'
        WHEN '2026-12-09' THEN 'the elf who has to fix santa''s sleigh'
        WHEN '2026-12-17' THEN 'a reindeer''s day off (finally)'
        -- Santa
        WHEN '2026-12-01' THEN 'a reindeer stuck in a chimney'
        WHEN '2026-12-11' THEN 'a mitten finding its twin'
        WHEN '2026-12-16' THEN 'rescuing someone trapped in a snow globe'
        WHEN '2026-12-21' THEN 'santa checking his list twice'
        -- The Grinch
        WHEN '2026-11-29' THEN 'a christmas tree drowning in tinsel'
        WHEN '2026-12-06' THEN 'the loudest christmas party on the block'
        WHEN '2026-12-13' THEN 'a christmas feast with every trimming'
        WHEN '2026-12-20' THEN 'animals caroling outside a grump''s door'
        WHEN '2026-12-24' THEN 'a sleigh piled high with presents'
    END
WHERE (day, prompt) IN (
    ('2026-11-28', 'a snowman''s first day'),
    ('2026-11-30', 'a gingerbread house with a problem'),
    ('2026-12-03', 'a cat versus the christmas tree'),
    ('2026-12-08', 'a present that''s way too big'),
    ('2026-12-09', 'santa''s sleigh breaking down'),
    ('2026-12-17', 'a reindeer''s day off'),
    ('2026-12-01', 'a penguin in a scarf'),
    ('2026-12-11', 'a mitten that lost its twin'),
    ('2026-12-16', 'someone trapped in a snow globe'),
    ('2026-12-21', 'the longest night of the year'),
    ('2026-11-29', 'a reindeer stuck in a chimney'),
    ('2026-12-06', 'an elf on strike'),
    ('2026-12-13', 'a sledding disaster'),
    ('2026-12-20', 'caroling animals'),
    ('2026-12-24', 'santa checking his list twice')
);
