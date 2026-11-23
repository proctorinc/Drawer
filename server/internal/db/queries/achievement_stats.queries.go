package queries

import (
	"context"
	"database/sql"
)

// Counts behind the newer achievements. Each takes the user's id once per ? in the query,
// and counts only what falls on or after their stats start day.
var (
	favoriteCountQuery = `SELECT COUNT(*) FROM user_favorite_submissions
		WHERE user_id = ? AND ` + countedAt("user_id", "created_at")
	pokeCountQuery = `SELECT COUNT(*) FROM pokes WHERE poker_id = ? AND ` + countedAt("poker_id", "created_at")
	// Only accepted suggestions record who wrote the prompt; it counts once its day comes
	promptPickedCountQuery = `SELECT COUNT(*) FROM daily_prompts
		WHERE created_by = ? AND day <= date('now') AND ` + countedDay("created_by", "day")

	judgedDoodlesOf = `
		FROM ai_reviews r JOIN user_submissions s ON s.id = r.submission_id
		WHERE s.user_id = ? AND r.status = 'done' AND ` + countedDay("s.user_id", "s.day")
	aiReviewCountQuery = `SELECT COUNT(*)` + judgedDoodlesOf
	// Scores from a judge that scores backwards (the Grinch) don't count toward these: his
	// high scores go to lazy doodles, and his low ones have their own achievement
	scoredFairly = ` AND r.personality_id NOT IN (SELECT id FROM ai_personalities WHERE scores_backwards = 1)`
	// Floored, so a 9.9 doesn't count as a perfect 10
	aiBestScoreQuery  = `SELECT COALESCE(CAST(MAX(r.score) AS INTEGER), 0)` + judgedDoodlesOf + scoredFairly
	aiGreatCountQuery = `SELECT COUNT(*)` + judgedDoodlesOf + scoredFairly + ` AND r.score >= 8`
	aiLowCountQuery   = `SELECT COUNT(*)` + judgedDoodlesOf + scoredFairly + ` AND r.score < 2`
	aiJudgesMetQuery  = `SELECT COUNT(DISTINCT r.personality_id)` + judgedDoodlesOf
	// The Grinch scores faults, so a flat 0 from him takes a flawless doodle
	grinchZeroCountQuery = `SELECT COUNT(*)` + judgedDoodlesOf + ` AND r.personality_id = 'ai-grinch' AND r.score = 0`
	// Drawing badly enough on purpose that the Grinch takes you as his accomplice (ai.AccompliceScore)
	grinchSideCountQuery = `SELECT COUNT(*)` + judgedDoodlesOf + ` AND r.personality_id = 'ai-grinch' AND r.score >= 7`
)

func countFor(repo *sql.DB, ctx context.Context, query, userID string) (int, error) {
	var n int
	err := repo.QueryRowContext(ctx, query, userID).Scan(&n)
	return n, err
}

// CalculateFavoriteCount is how many doodles the user has pinned to their book
func CalculateFavoriteCount(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, favoriteCountQuery, userID)
}

// CalculatePokeCount is how many times the user has poked a friend
func CalculatePokeCount(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, pokeCountQuery, userID)
}

// CalculatePromptPickedCount is how many of the user's suggestions became a daily prompt
func CalculatePromptPickedCount(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, promptPickedCountQuery, userID)
}

// CalculateAIReviewCount is how many of the user's doodles a judge has reviewed
func CalculateAIReviewCount(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, aiReviewCountQuery, userID)
}

// CalculateAIBestScore is the user's best judge score, rounded down
func CalculateAIBestScore(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, aiBestScoreQuery, userID)
}

// CalculateAIGreatCount is how many of the user's doodles scored 8 or more
func CalculateAIGreatCount(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, aiGreatCountQuery, userID)
}

// CalculateAILowCount is how many of the user's doodles scored under 2
func CalculateAILowCount(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, aiLowCountQuery, userID)
}

// CalculateAIJudgesMet is how many different judges have reviewed the user's doodles
func CalculateAIJudgesMet(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, aiJudgesMetQuery, userID)
}

// CalculateGrinchZeroCount is how many of the user's doodles the Grinch scored a flat 0
func CalculateGrinchZeroCount(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, grinchZeroCountQuery, userID)
}

// CalculateGrinchSideCount is how many of the user's doodles the Grinch took as an accomplice's
func CalculateGrinchSideCount(repo *sql.DB, ctx context.Context, userID string) (int, error) {
	return countFor(repo, ctx, grinchSideCountQuery, userID)
}
