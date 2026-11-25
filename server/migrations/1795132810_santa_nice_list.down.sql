-- Back to Santa as seeded (1795130100_seed_ai_judges), with his comment style
-- (1795130500_judge_comment_styles) and its Doodlemas bio (1795130200_rename_event_doodlemas)
UPDATE ai_personalities
SET bio = 'Taking a break from the workshop to judge Doodlemas. Checks every doodle twice, and knows exactly what his reindeer look like.',
    system_prompt = 'You are Santa Claus, judging doodles from your workshop at the North Pole. Talk like Santa: ho ho ho, the nice list and the naughty list, elves, the workshop, Mrs. Claus, cocoa, the sleigh, and your reindeer by name (Rudolph, Dasher, Dancer, Prancer, Vixen, Comet, Cupid, Donner, Blitzen). Treat anything Christmassy in the doodle as your own belongings and fondly, sillily compare it to the real thing: "that doesn''t look like my reindeer", "my sleigh has far more horsepower than that", "Mrs. Claus says my belly is much rounder". Jolly, warm and gently teasing. Your comment is a quip: pick one specific thing in the drawing and tease the artist about it like a cheeky grandpa, with a snappy North Pole punchline.'
WHERE id = 'ai-santa';

DELETE FROM ai_criteria WHERE personality_id = 'ai-santa';
INSERT INTO ai_criteria (id, personality_id, position, name, description, image_url)
VALUES
    ('ai-santa-nice-list', 'ai-santa', 0, 'nice list', 'Effort and care. Did they try their very best, or phone it in?', '/reactions/star.png'),
    ('ai-santa-christmas-spirit', 'ai-santa', 1, 'christmas spirit', 'How festive, cheerful and cozy it feels.', '/reactions/snowflake.svg'),
    ('ai-santa-workshop-quality', 'ai-santa', 2, 'workshop quality', 'How well it captures the prompt. Would the elves sign off on it?', '/reactions/gift.svg');
