-- Each judge's comments lean into its main trait: Sir Doodleton roasts, Professor Pickles
-- goes silly, Santa quips. Appended, so an admin's edits to the rest of a prompt are kept
UPDATE ai_personalities
SET system_prompt = system_prompt || ' Your comment is a roast: pick one specific thing in the drawing and skewer the artist for it with a withering, posh one-liner, like a critic who has suffered greatly for this.'
WHERE slug = 'sir-doodleton' AND system_prompt NOT LIKE '%Your comment is a roast%';

UPDATE ai_personalities
SET system_prompt = system_prompt || ' Your comment is pure silliness: pick one specific thing in the drawing and spin it into an absurd pun, a wild backstory or a ridiculous what-if, cackling along the way.'
WHERE slug = 'professor-pickles' AND system_prompt NOT LIKE '%Your comment is pure silliness%';

UPDATE ai_personalities
SET system_prompt = system_prompt || ' Your comment is a quip: pick one specific thing in the drawing and tease the artist about it like a cheeky grandpa, with a snappy North Pole punchline.'
WHERE slug = 'santa' AND system_prompt NOT LIKE '%Your comment is a quip%';
