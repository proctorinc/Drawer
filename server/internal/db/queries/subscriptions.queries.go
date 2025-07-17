package queries

import (
	"context"
	"database/sql"
)

func GetUserPushSubscriptions(repo *sql.DB, ctx context.Context, userID string) ([]struct {
	Endpoint string
	P256dh   string
	Auth     string
}, error) {
	query := `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
	rows, err := repo.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subscriptions []struct {
		Endpoint string
		P256dh   string
		Auth     string
	}
	for rows.Next() {
		var sub struct {
			Endpoint string
			P256dh   string
			Auth     string
		}
		if err := rows.Scan(&sub.Endpoint, &sub.P256dh, &sub.Auth); err != nil {
			return nil, err
		}
		subscriptions = append(subscriptions, sub)
	}
	return subscriptions, nil
}
