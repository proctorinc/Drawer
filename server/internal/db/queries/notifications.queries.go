package queries

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type SubscribeUserToPushNotificationsParams struct {
	UserId    string
	Endpoint  string
	P256dhKey string
	AuthKey   string
}

func SubscribeUserToPushNotifications(repo *sql.DB, ctx context.Context, params SubscribeUserToPushNotificationsParams) error {
	id := uuid.New().String()

	_, err := repo.Exec(`INSERT OR REPLACE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, params.UserId, params.Endpoint, params.P256dhKey, params.AuthKey, time.Now())

	return err
}

type UnsubscribeUserFromPushNotificationsParams struct {
	UserId   string
	Endpoint string
}

func UnsubscribeUserFromPushNotifications(repo *sql.DB, ctx context.Context, params UnsubscribeUserFromPushNotificationsParams) error {
	_, err := repo.Exec(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`, params.UserId, params.Endpoint)

	return err
}
