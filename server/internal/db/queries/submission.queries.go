package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"
)

func GetSubmissionReactions(repo *sql.DB, ctx context.Context, submissionID string) ([]models.Reaction, error) {
	query := `
		SELECT
			r.id,
			r.reaction_id,
			r.created_at,
			u.id,
			u.username,
			u.email,
			u.created_at
		FROM reactions r
		JOIN users u ON r.user_id = u.id
		WHERE r.content_type = 'submission' AND r.content_id = ?
		ORDER BY r.created_at ASC
	`

	rows, err := repo.QueryContext(ctx, query, submissionID)
	if err != nil {
		return []models.Reaction{}, fmt.Errorf("error fetching reactions for submission: %w", err)
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

func ToggleReaction(repo *sql.DB, ctx context.Context, userID, contentType, contentID, reactionID string) error {
	// Validate that the content exists based on content type
	var contentExistsQuery string
	switch contentType {
	case "submission":
		contentExistsQuery = `SELECT 1 FROM user_submissions WHERE id = ?`
	case "comment":
		contentExistsQuery = `SELECT 1 FROM comments WHERE id = ?`
	default:
		return fmt.Errorf("invalid content type: %s", contentType)
	}

	var contentExists int
	err := repo.QueryRowContext(ctx, contentExistsQuery, contentID).Scan(&contentExists)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("%s %s does not exist", contentType, contentID)
		}
		return fmt.Errorf("error checking if %s exists: %w", contentType, err)
	}

	// Check if the reaction already exists
	existsQuery := `
		SELECT 1 FROM reactions
		WHERE user_id = ? AND content_type = ? AND content_id = ? AND reaction_id = ?
	`
	var exists int
	err = repo.QueryRowContext(ctx, existsQuery, userID, contentType, contentID, reactionID).Scan(&exists)

	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("error checking if reaction exists: %w", err)
	}

	if errors.Is(err, sql.ErrNoRows) {
		// Reaction doesn't exist, insert it
		insertQuery := `
			INSERT INTO reactions (user_id, content_type, content_id, reaction_id)
			VALUES (?, ?, ?, ?)
		`
		_, err = repo.ExecContext(ctx, insertQuery, userID, contentType, contentID, reactionID)
		if err != nil {
			return fmt.Errorf("error adding reaction: %w", err)
		}
	} else {
		// Reaction exists, remove it
		deleteQuery := `
			DELETE FROM reactions
			WHERE user_id = ? AND content_type = ? AND content_id = ? AND reaction_id = ?
		`
		_, err = repo.ExecContext(ctx, deleteQuery, userID, contentType, contentID, reactionID)
		if err != nil {
			return fmt.Errorf("error removing reaction: %w", err)
		}
	}

	return nil
}

func GetSubmissionReactionCounts(repo *sql.DB, ctx context.Context, submissionID string) ([]models.ReactionCount, error) {
	query := `
		SELECT
			reaction_id,
			COUNT(*) as count
		FROM reactions
		WHERE content_type = 'submission' AND content_id = ?
		GROUP BY reaction_id
		ORDER BY count DESC, reaction_id ASC
	`

	rows, err := repo.QueryContext(ctx, query, submissionID)
	if err != nil {
		return []models.ReactionCount{}, fmt.Errorf("error fetching reaction counts for submission: %w", err)
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

func ToggleFavoriteSubmission(repo *sql.DB, ctx context.Context, userID, submissionID string) (added bool, err error) {
	// Check if the submission belongs to the user
	var ownerID string
	err = repo.QueryRowContext(ctx, "SELECT user_id FROM user_submissions WHERE id = ?", submissionID).Scan(&ownerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, errors.New("submission not found")
		}
		return false, err
	}
	if ownerID != userID {
		return false, errors.New("can only favorite your own submission")
	}

	// Check if already favorited
	var favID string
	err = repo.QueryRowContext(ctx, "SELECT id FROM user_favorite_submissions WHERE user_id = ? AND submission_id = ?", userID, submissionID).Scan(&favID)
	if err == nil {
		// Already favorited, so remove
		_, delErr := repo.ExecContext(ctx, "DELETE FROM user_favorite_submissions WHERE id = ?", favID)
		if delErr != nil {
			return false, delErr
		}
		return false, nil // removed
	} else if err != sql.ErrNoRows {
		return false, err
	}

	// Not favorited, so add
	// Get next order_num
	var nextOrder int
	err = repo.QueryRowContext(ctx, "SELECT COALESCE(MAX(order_num), 0) + 1 FROM user_favorite_submissions WHERE user_id = ?", userID).Scan(&nextOrder)
	if err != nil {
		return false, err
	}
	_, insErr := repo.ExecContext(ctx, `INSERT INTO user_favorite_submissions (id, user_id, submission_id, order_num) VALUES (?, ?, ?, ?)`, uuid.New().String(), userID, submissionID, nextOrder)
	if insErr != nil {
		return false, insErr
	}
	return true, nil // added
}

func SwapFavoriteOrder(repo *sql.DB, ctx context.Context, userID, favID1, favID2 string) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	var order1, order2 int
	// Get order_num for both favorites and check ownership
	row := tx.QueryRowContext(ctx, `SELECT order_num FROM user_favorite_submissions WHERE id = ? AND user_id = ?`, favID1, userID)
	if err = row.Scan(&order1); err != nil {
		return err
	}
	row = tx.QueryRowContext(ctx, `SELECT order_num FROM user_favorite_submissions WHERE id = ? AND user_id = ?`, favID2, userID)
	if err = row.Scan(&order2); err != nil {
		return err
	}

	// Swap the order_num values
	_, err = tx.ExecContext(ctx, `UPDATE user_favorite_submissions SET order_num = CASE WHEN id = ? THEN ? WHEN id = ? THEN ? END WHERE id IN (?, ?) AND user_id = ?`, favID1, order2, favID2, order1, favID1, favID2, userID)
	return err
}
