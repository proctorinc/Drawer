-- Decorations unlocked by the regular achievements: silly ones for the easy stickers,
-- showier ones the harder they are to earn. Drawn by src/decorations/decorations.tsx.
INSERT OR IGNORE INTO reward_unlocks (id, name, description, achievement_id)
VALUES
    -- drawing
    ('PENCIL_EAR', 'Pencil Behind the Ear', 'A pencil tucked behind your ear, always ready', 'doodle-25'),
    ('BERET', 'Artist''s Beret', 'A beret with a brush tucked in the band', 'pinned-3'),
    ('CRAYON_CROWN', 'Crayon Crown', 'A crown of crayons for a serious hoarder', 'doodle-250'),
    ('ORBIT', 'Sun & Moon Orbit', 'The sun and moon circling you, a year of doodles in orbit', 'doodle-365'),
    -- streaks
    ('SWEATBAND', 'Sweatband', 'A sweatband for two weeks of hard work', 'streak-14'),
    ('BLAZE', 'Ring of Fire', 'Flames all around you. Unstoppable', 'streak-100'),
    -- friends
    ('PROPELLER_CAP', 'Propeller Cap', 'A beanie with a propeller that never stops', 'friend-1'),
    ('SPEECH_BUBBLE', 'Speech Bubble', 'A speech bubble that''s always typing', 'comment-25'),
    ('FOAM_FINGER', 'Foam Finger', 'A giant foam finger, for poking', 'poke-1'),
    ('LIGHTBULB', 'Bright Idea', 'A lightbulb hovering by your head', 'prompt-picked-1'),
    ('JESTER_HAT', 'Jester Hat', 'Three floppy points with jingling bells', 'cry-laughs-10'),
    ('HEART_SWARM', 'Fan Hearts', 'Hearts floating up from your fans', 'reactions-received-250'),
    -- AI judges
    ('PLUNGER_HAT', 'Plunger Hat', 'A toilet plunger, suctioned right on. It''s fine', 'judge-low-1'),
    ('BAND_AIDS', 'Band-Aids', 'Crossed band-aids on a sore spot', 'judged-25'),
    ('APPLE_HAT', 'Apple for the Teacher', 'An apple balanced on your head, with a guest', 'judge-best-8'),
    ('GILDED_FRAME', 'Gilded Frame', 'An ornate gold frame, fit for a gallery', 'judge-best-9'),
    ('HALO', 'Halo', 'A floating golden halo for a perfect ten', 'judge-best-10'),
    -- levels
    ('RAIN_CLOUD', 'Silver Lining', 'A little rain cloud with a silver lining', 'level-5'),
    ('CROWN', 'Crown', 'A gold crown with gems, for grandmasters', 'level-20'),
    ('MYTHIC_WINGS', 'Mythic Wings', 'A pair of flapping wings', 'level-30');
