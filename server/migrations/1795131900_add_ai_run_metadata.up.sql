-- How each AI run's scores were adjusted in code, as JSON: what the judge saw, the effort
-- and prompt ratings with their penalty and bonus, and any random love/hate swing
-- ("boost" or "super") with its points
ALTER TABLE ai_runs ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';
