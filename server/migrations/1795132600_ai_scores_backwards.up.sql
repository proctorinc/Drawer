-- A judge can score backwards: its criteria measure faults (gloom, mess, missing the prompt)
-- from 0 to 10, so the better the doodle, the lower its scores, and a 0 is the best a doodle
-- can do. Its scores count like any other judge's (a 0 earns nothing).
ALTER TABLE ai_personalities ADD COLUMN scores_backwards INTEGER NOT NULL DEFAULT 0;
