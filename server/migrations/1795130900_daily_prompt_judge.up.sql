-- An admin can hand a day's doodles to a particular AI judge. NULL leaves it to the running
-- event's judge, else the default one. No foreign key: deleting a judge clears it in code.
ALTER TABLE daily_prompts ADD COLUMN judge_id TEXT;
