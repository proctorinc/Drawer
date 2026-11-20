package queries

import (
	"context"
	"database/sql"
)

// Counts behind the newer achievements. Each takes the user's id once per ? in the query.
const (
	favoriteCountQuery = `SELECT COUNT(*) FROM user_favorite_submissions WHERE user_id = ?`
	pokeCountQuery     = `SELECT COUNT(*) FROM pokes WHERE poker_id = ?`
	// Only accepted suggestions record who wrote the prompt; it counts once its day comes
	promptPickedCountQuery = `SELECT COUNT(*) FROM daily_prompts WHERE created_by = ? AND day <= date('now')`

	judgedDoodlesOf = `
		FROM ai_reviews r JOIN user_submissions s ON s.id = r.submission_id
		WHERE s.user_id = ? AND r.status = 'done'`
	aiReviewCountQuery = `SELECT COUNT(*)` + judgedDoodlesOf
	// Floored, so a 9.9 doesn't count as a perfect 10
	aiBestScoreQuery  = `SELECT COALESCE(CAST(MAX(r.score) AS INTEGER), 0)` + judgedDoodlesOf
	aiGreatCountQuery = `SELECT COUNT(*)` + judgedDoodlesOf + ` AND r.score >= 8`
	aiLowCountQuery   = `SELECT COUNT(*)` + judgedDoodlesOf + ` AND r.score < 2`
	aiJudgesMetQuery  = `SELECT COUNT(DISTINCT r.personality_id)` + judgedDoodlesOf
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
