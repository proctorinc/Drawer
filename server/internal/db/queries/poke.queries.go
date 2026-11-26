package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"time"
)

func AreFriends(repo *sql.DB, ctx context.Context, userID, otherID string) (bool, error) {
	query := `SELECT EXISTS(
		SELECT 1 FROM friendships
		WHERE ((user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)) AND state = 'accepted'
	)`
	var friends bool
	err := repo.QueryRowContext(ctx, query, userID, otherID, otherID, userID).Scan(&friends)
	return friends, err
}

// RecordPoke saves a poke for the given day. It returns false when the poker
// already poked that friend that day.
func RecordPoke(repo *sql.DB, ctx context.Context, pokerID, pokeeID, day string) (bool, error) {
	res, err := repo.ExecContext(ctx,
		`INSERT OR IGNORE INTO pokes (poker_id, pokee_id, day) VALUES (?, ?, ?)`,
		pokerID, pokeeID, day)
	if err != nil {
		return false, err
	}
	inserted, err := res.RowsAffected()
	return inserted == 1, err
}

// GetPokeesOn returns the IDs of everyone the poker poked on the given day
func GetPokeesOn(repo *sql.DB, ctx context.Context, pokerID, day string) (map[string]bool, error) {
	rows, err := repo.QueryContext(ctx, `SELECT pokee_id FROM pokes WHERE poker_id = ? AND day = ?`, pokerID, day)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	pokees := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		pokees[id] = true
	}
	return pokees, rows.Err()
}

// GetPokesReceived returns the pokes the user got in the last week as activity, newest first
func GetPokesReceived(repo *sql.DB, ctx context.Context, userID string) ([]models.Activity, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT p.day, u.id, u.username, u.email, u.created_at, u.avatar_type, u.avatar_url, u.decoration, u.color_hue, p.created_at
		FROM pokes p
		JOIN users u ON u.id = p.poker_id
		WHERE p.pokee_id = ? AND p.created_at >= datetime('now', '-7 days')
		ORDER BY p.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	pokes := []models.Activity{}
	for rows.Next() {
		var day string
		var poker models.User
		var pokedAt time.Time
		if err := rows.Scan(&day, &poker.ID, &poker.Username, &poker.Email, &poker.CreatedAt, &poker.AvatarType, &poker.AvatarURL, &poker.Decoration, &poker.ColorHue, &pokedAt); err != nil {
			return nil, err
		}
		pokes = append(pokes, models.Activity{
			ID:     "poke-" + poker.ID + "-" + day,
			User:   poker,
			Action: models.ActivityActionPoke,
			Date:   pokedAt,
		})
	}
	return pokes, rows.Err()
}
