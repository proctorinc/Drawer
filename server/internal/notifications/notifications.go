package notifications

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"encoding/json"
	"fmt"

	"github.com/SherClockHolmes/webpush-go"
)

func SendWebPush(sub models.PushSubscription, message string, vapidPublic, vapidPrivate string) error {
	subJSON := webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			P256dh: sub.P256dh,
			Auth:   sub.Auth,
		},
	}
	resp, err := webpush.SendNotification([]byte(message), &subJSON, &webpush.Options{
		VAPIDPublicKey:  vapidPublic,
		VAPIDPrivateKey: vapidPrivate,
		TTL:             30,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// SendNotificationToUser sends a notification to a specific user
func SendNotificationToUser(repo *sql.DB, userID string, data models.NotificationData, cfg *config.Config) error {
	subscriptions, err := queries.GetUserPushSubscriptions(repo, context.Background(), userID)
	if err != nil {
		return err
	}

	message, err := json.Marshal(data)
	if err != nil {
		return err
	}

	for _, sub := range subscriptions {
		pushSub := models.PushSubscription{
			Endpoint: sub.Endpoint,
			P256dh:   sub.P256dh,
			Auth:     sub.Auth,
		}
		if err := SendWebPush(pushSub, string(message), cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey); err != nil {
		}
	}
	return nil
}

// NotifyFriendsOfSubmission sends notifications to friends when a user submits
func NotifyFriendsOfSubmission(repo *sql.DB, userID, username, submissionID string, cfg *config.Config) error {
	friends, err := queries.GetUserFriends(repo, context.Background(), userID)
	if err != nil {
		return err
	}

	data := models.NotificationData{
		Type:     models.NotificationTypeFriendSubmission,
		Title:    "New Drawing from Friend",
		Body:     fmt.Sprintf("%s just posted their daily drawing!", username),
		URL:      fmt.Sprintf("/draw/submission/%s", submissionID),
		UserID:   userID,
		Username: username,
		Action:   "submitted",
	}

	for _, friendID := range friends {
		if err := SendNotificationToUser(repo, friendID, data, cfg); err != nil {
			// Log error but continue with other friends
			fmt.Printf("Failed to notify friend %s: %v\n", friendID, err)
		}
	}
	return nil
}

// NotifyUserOfReaction sends notification when someone reacts to user's content
func NotifyUserOfReaction(repo *sql.DB, reactorID, reactorUsername, contentOwnerID, contentID, reactionType, contentType string, cfg *config.Config) error {
	// Don't notify if user is reacting to their own content
	if reactorID == contentOwnerID {
		return nil
	}

	var title, body string
	if contentType == "submission" {
		title = "New Reaction"
		body = fmt.Sprintf("%s reacted to your doodle", reactorUsername)
	} else {
		title = "New Comment Reaction"
		body = fmt.Sprintf("%s reacted to your comment", reactorUsername)
	}

	data := models.NotificationData{
		Type:     models.NotificationTypeReaction,
		Title:    title,
		Body:     body,
		URL:      fmt.Sprintf("/draw/submission/%s", contentID),
		UserID:   reactorID,
		Username: reactorUsername,
		Action:   "reacted",
	}

	return SendNotificationToUser(repo, contentOwnerID, data, cfg)
}

// NotifyUserOfComment sends notification when someone comments on user's submission
func NotifyUserOfComment(repo *sql.DB, commenterID, commenterUsername, submissionOwnerID, submissionID string, cfg *config.Config) error {
	// Don't notify if user is commenting on their own submission
	if commenterID == submissionOwnerID {
		return nil
	}

	data := models.NotificationData{
		Type:     models.NotificationTypeComment,
		Title:    "New Comment",
		Body:     fmt.Sprintf("%s commented on your drawing", commenterUsername),
		URL:      fmt.Sprintf("/draw/submission/%s", submissionID),
		UserID:   commenterID,
		Username: commenterUsername,
		Action:   "commented",
	}

	return SendNotificationToUser(repo, submissionOwnerID, data, cfg)
}
