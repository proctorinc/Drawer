-- The hue (0-359) a user picked for their profile color, or NULL to use the color derived from their name
ALTER TABLE users ADD COLUMN color_hue INTEGER;
