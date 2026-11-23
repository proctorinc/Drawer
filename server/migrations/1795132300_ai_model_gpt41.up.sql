-- The judges move from gpt-4.1-mini to gpt-4.1: it reads the artist's idea far more reliably
-- and sees craft finer than the brush. The admin screen saves whatever model was showing, so
-- the old default is likely stored explicitly; move it along, but keep any other choice.
UPDATE ai_settings SET value = 'gpt-4.1' WHERE key = 'openai_model' AND value = 'gpt-4.1-mini';
