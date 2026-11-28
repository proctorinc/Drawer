-- Notes for the AI judge on how to read a day's prompt, sent with its evaluation. Free text in
-- a standard shape the admin screen starts from:
--   What it means: / Counts: / Doesn't count: / Extra credit:
ALTER TABLE daily_prompts ADD COLUMN judge_context TEXT NOT NULL DEFAULT '';

-- The first notes: the snowman's first day. Only if the day still has that prompt.
UPDATE daily_prompts SET judge_context = 'What it means:
A snowman starting a job, on his very first day of it.

Counts:
- The job: any job or role, as long as it''s clear what it is (a uniform, a tool, a workplace, a name tag, a task under way). Being a snowman counts as a job in itself: a freshly built snowman reporting for duty in the yard, standing guard, waving at cars.
- The first day: any clear sign he''s new at it. Getting it wrong, looking confused or nervous, using the wrong tool (or the wrong end of it), a "trainee" or "new hire" badge, a boss showing him the ropes, a welcome banner, a first-day mishap like melting on the job.
- The first day can be shown and not said: a mistake or a mix-up on its own is enough.

Doesn''t count:
- A plain snowman with no hint of a job, or no hint that he''s new at it: that part of the prompt is missing.
- A person, a snow angel or a pile of snow instead of a snowman.

Extra credit:
- A job that''s a funny fit for a snowman (barista with hot coffee, lifeguard, chef at a stove, sauna attendant).
- First-day nerves told through small details: a dropped tool, a sweaty melt, a wrong turn, a crooked tie.'
WHERE day = '2026-11-28' AND prompt = 'a snowman''s first day on the job';
