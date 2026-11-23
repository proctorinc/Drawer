-- 2026-11-24 ("a haunted vending machine") hands out a fourth pencil: a fine black one.
-- Its first three keep the day's colors at the regular size.
UPDATE daily_prompts
SET pencils = json_array(
	json_object('color', json_extract(colors, '$[0]'), 'size', 20),
	json_object('color', json_extract(colors, '$[1]'), 'size', 20),
	json_object('color', json_extract(colors, '$[2]'), 'size', 20),
	json_object('color', '#000000', 'size', 6)
)
WHERE day = '2026-11-24' AND pencils IS NULL;
