-- The pencils a day's prompt hands out, as a JSON array of {"color": "#rrggbb", "size": n}.
-- NULL gives the usual three: the first three colors at the default size.
ALTER TABLE daily_prompts ADD COLUMN pencils TEXT;
