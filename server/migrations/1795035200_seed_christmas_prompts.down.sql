-- Removes only the seeded rows: days an admin scheduled (or edited) differ in prompt or created_by.
DELETE FROM daily_prompts
WHERE day BETWEEN '2026-11-27' AND '2026-12-25'
  AND created_by IS NULL
  AND prompt IN (
    'leftovers in disguise',
    'a snowman''s first day',
    'a reindeer stuck in a chimney',
    'a gingerbread house with a problem',
    'a penguin in a scarf',
    'the world''s ugliest sweater',
    'a cat versus the christmas tree',
    'an epic snowball fight',
    'hot cocoa with too many marshmallows',
    'an elf on strike',
    'a polar bear ice skating',
    'a present that''s way too big',
    'santa''s sleigh breaking down',
    'a candy cane in love',
    'a mitten that lost its twin',
    'a tangle of christmas lights',
    'a sledding disaster',
    'a nutcracker at the gym',
    'cookies left for santa (half eaten)',
    'someone trapped in a snow globe',
    'a reindeer''s day off',
    'awkward under the mistletoe',
    'gift-wrapping a pet',
    'caroling animals',
    'the longest night of the year',
    'stockings by the fireplace',
    'the north pole''s busiest workshop',
    'santa checking his list twice',
    'christmas morning'
  );
