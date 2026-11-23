-- One last Grinch day before the big one: he judges Christmas Eve too, on top of his Sundays,
-- for a final shot at ruining it. Only if an admin hasn't already picked a judge for the day.
UPDATE daily_prompts SET judge_id = 'ai-grinch'
WHERE day = '2026-12-24' AND judge_id IS NULL;
