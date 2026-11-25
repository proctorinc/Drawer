UPDATE daily_prompts SET prompt = CASE day
        WHEN '2026-11-28' THEN 'a snowman''s first day'
        WHEN '2026-11-30' THEN 'a gingerbread house with a problem'
        WHEN '2026-12-03' THEN 'a cat versus the christmas tree'
        WHEN '2026-12-08' THEN 'a present that''s way too big'
        WHEN '2026-12-09' THEN 'santa''s sleigh breaking down'
        WHEN '2026-12-17' THEN 'a reindeer''s day off'
        WHEN '2026-12-01' THEN 'a penguin in a scarf'
        WHEN '2026-12-11' THEN 'a mitten that lost its twin'
        WHEN '2026-12-16' THEN 'someone trapped in a snow globe'
        WHEN '2026-12-21' THEN 'the longest night of the year'
        WHEN '2026-11-29' THEN 'a reindeer stuck in a chimney'
        WHEN '2026-12-06' THEN 'an elf on strike'
        WHEN '2026-12-13' THEN 'a sledding disaster'
        WHEN '2026-12-20' THEN 'caroling animals'
        WHEN '2026-12-24' THEN 'santa checking his list twice'
    END
WHERE (day, prompt) IN (
    ('2026-11-28', 'a snowman''s first day on the job'),
    ('2026-11-30', 'a gingerbread house behind schedule'),
    ('2026-12-03', 'an elf on strike'),
    ('2026-12-08', 'delivering a present that''s way too big'),
    ('2026-12-09', 'the elf who has to fix santa''s sleigh'),
    ('2026-12-17', 'a reindeer''s day off (finally)'),
    ('2026-12-01', 'a reindeer stuck in a chimney'),
    ('2026-12-11', 'a mitten finding its twin'),
    ('2026-12-16', 'rescuing someone trapped in a snow globe'),
    ('2026-12-21', 'santa checking his list twice'),
    ('2026-11-29', 'a christmas tree drowning in tinsel'),
    ('2026-12-06', 'the loudest christmas party on the block'),
    ('2026-12-13', 'a christmas feast with every trimming'),
    ('2026-12-20', 'animals caroling outside a grump''s door'),
    ('2026-12-24', 'a sleigh piled high with presents')
);
