-- Admin re-runs and testing-ground runs no longer replace a doodle's review on their own: an
-- admin applies the run they like. Each run records when it was applied, and each review
-- which run it came from, so the AI log can show what players see.
ALTER TABLE ai_runs ADD COLUMN applied_at TIMESTAMP;
ALTER TABLE ai_reviews ADD COLUMN run_id TEXT;

-- Until now every successful real-doodle run and admin re-run went straight onto its doodle
UPDATE ai_runs SET applied_at = created_at
WHERE kind IN ('submission', 'rerun') AND status = 'done' AND submission_id IS NOT NULL;

-- A review came from its doodle's newest such run
UPDATE ai_reviews SET run_id = (
	SELECT r.id FROM ai_runs r
	WHERE r.submission_id = ai_reviews.submission_id AND r.applied_at IS NOT NULL
	ORDER BY datetime(r.created_at) DESC, r.rowid DESC
	LIMIT 1
)
WHERE status = 'done';
