-- Doodling on Thanksgiving earns a sticker, which unlocks the turkey hat decoration
INSERT INTO achievements (id, name, description, image_url, achievement_field, achievement_value)
VALUES ('thanksgiving-doodle', 'gobble gobble', 'Draw a doodle on Thanksgiving', '/badges/thanksgiving_total-1.svg', 'THANKSGIVING_TOTAL', 1);

INSERT INTO reward_unlocks (id, name, description, achievement_id)
VALUES ('TURKEY_HAT', 'Turkey Hat', 'A roast turkey to wear on your head', 'thanksgiving-doodle');
