package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"fmt"
	"log"
)

func GetCommentReactions(repo *sql.DB, ctx context.Context, commentID string) ([]models.Reaction, error) {
	query := `
		SELECT
			r.id,
			r.reaction_id,
			r.created_at,
			u.id,
			u.username,
			u.email,
			u.created_at,
			u.avatar_type,
			u.avatar_url
		FROM reactions r
		JOIN users u ON r.user_id = u.id
		WHERE r.content_type = 'comment' AND r.content_id = ?
		ORDER BY r.created_at ASC
	`

	rows, err := repo.QueryContext(ctx, query, commentID)
	if err != nil {
		return []models.Reaction{}, fmt.Errorf("error fetching reactions for comment: %w", err)
	}
	defer rows.Close()

	reactions := []models.Reaction{}
	for rows.Next() {
		var reaction models.Reaction
		var user models.User
		err := rows.Scan(
			&reaction.ID,
			&reaction.ReactionID,
			&reaction.CreatedAt,
			&user.ID,
			&user.Username,
			&user.Email,
			&user.CreatedAt,
			&user.AvatarType,
			&user.AvatarURL,
		)
		if err != nil {
			log.Printf("Error scanning reaction row: %v", err)
			continue
		}
		reaction.User = user
		reactions = append(reactions, reaction)
	}

	// Ensure we always return a non-nil slice
	if reactions == nil {
		reactions = []models.Reaction{}
	}

	return reactions, nil
}

func GetCommentReactionCounts(repo *sql.DB, ctx context.Context, commentID string) ([]models.ReactionCount, error) {
	query := `
		SELECT
			reaction_id,
			COUNT(*) as count
		FROM reactions
		WHERE content_type = 'comment' AND content_id = ?
		GROUP BY reaction_id
		ORDER BY count DESC, reaction_id ASC
	`

	rows, err := repo.QueryContext(ctx, query, commentID)
	if err != nil {
		return []models.ReactionCount{}, fmt.Errorf("error fetching reaction counts for comment: %w", err)
	}
	defer rows.Close()

	counts := []models.ReactionCount{}
	for rows.Next() {
		var count models.ReactionCount
		err := rows.Scan(&count.ReactionID, &count.Count)
		if err != nil {
			log.Printf("Error scanning reaction count row: %v", err)
			continue
		}
		counts = append(counts, count)
	}

	// Ensure we always return a non-nil slice
	if counts == nil {
		counts = []models.ReactionCount{}
	}

	return counts, nil
}
