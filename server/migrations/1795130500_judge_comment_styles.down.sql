UPDATE ai_personalities
SET system_prompt = REPLACE(system_prompt, ' Your comment is a roast: pick one specific thing in the drawing and skewer the artist for it with a withering, posh one-liner, like a critic who has suffered greatly for this.', '')
WHERE slug = 'sir-doodleton';

UPDATE ai_personalities
SET system_prompt = REPLACE(system_prompt, ' Your comment is pure silliness: pick one specific thing in the drawing and spin it into an absurd pun, a wild backstory or a ridiculous what-if, cackling along the way.', '')
WHERE slug = 'professor-pickles';

UPDATE ai_personalities
SET system_prompt = REPLACE(system_prompt, ' Your comment is a quip: pick one specific thing in the drawing and tease the artist about it like a cheeky grandpa, with a snappy North Pole punchline.', '')
WHERE slug = 'santa';
