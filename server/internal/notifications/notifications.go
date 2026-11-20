package notifications

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/SherClockHolmes/webpush-go"
)

// errSubscriptionGone means the push service no longer knows the subscription
// (the user revoked permission, cleared site data, or it expired).
var errSubscriptionGone = errors.New("push subscription is gone")

// madeWithOtherKey reports FCM's rejection of a subscription created under a
// previous VAPID key pair. Such a subscription can never receive pushes from
// this server, and its browser saves a replacement on its next sign-in, so it
// is as good as gone. Other 403s (a bad JWT, say) are the server's fault and
// must not wipe subscriptions.
func madeWithOtherKey(status int, body []byte) bool {
	return status == http.StatusForbidden &&
		strings.Contains(strings.ToLower(string(body)), "credentials used to create the subscription")
}

func sendWebPush(sub models.PushSubscription, message []byte, cfg *config.Config) error {
	resp, err := webpush.SendNotification(message, &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
	}, &webpush.Options{
		Subscriber:      cfg.VAPIDSubject,
		VAPIDPublicKey:  cfg.VAPIDPublicKey,
		VAPIDPrivateKey: cfg.VAPIDPrivateKey,
		TTL:             30,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Push services report rejections as ordinary HTTP responses, not errors
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
		return errSubscriptionGone
	}
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		if madeWithOtherKey(resp.StatusCode, body) {
			return errSubscriptionGone
		}
		return fmt.Errorf("push service returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

// SendNotificationToUser sends a notification to every device the user has subscribed
func SendNotificationToUser(repo *sql.DB, userID string, data models.NotificationData, cfg *config.Config) error {
	_, err := DeliverToUser(repo, userID, data, cfg)
	return err
}

// DeliverToUser is SendNotificationToUser that also counts the devices the
// push services accepted the notification for. Dead subscriptions are deleted
// and count as neither delivered nor failed.
func DeliverToUser(repo *sql.DB, userID string, data models.NotificationData, cfg *config.Config) (int, error) {
	if cfg.VAPIDPublicKey == "" || cfg.VAPIDPrivateKey == "" {
		return 0, errors.New("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set to send push notifications")
	}

	ctx := context.Background()
	subscriptions, err := queries.GetUserPushSubscriptions(repo, ctx, userID)
	if err != nil {
		return 0, err
	}

	message, err := json.Marshal(data)
	if err != nil {
		return 0, err
	}

	delivered := 0
	var failures []error
	for _, sub := range subscriptions {
		err := sendWebPush(models.PushSubscription(sub), message, cfg)
		if errors.Is(err, errSubscriptionGone) {
			if err := queries.DeletePushSubscription(repo, ctx, sub.Endpoint); err != nil {
				log.Printf("Failed to delete expired push subscription for user %s: %v", userID, err)
			}
			continue
		}
		if err != nil {
			failures = append(failures, fmt.Errorf("%s: %w", endpointHost(sub.Endpoint), err))
			continue
		}
		delivered++
	}
	return delivered, errors.Join(failures...)
}

// endpointHost identifies the push service without logging the per-device token in the URL
func endpointHost(endpoint string) string {
	if u, err := url.Parse(endpoint); err == nil {
		return u.Host
	}
	return "unknown push service"
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

// NotifyUserOfAIReview tells the artist an AI judge has scored and commented on their doodle
func NotifyUserOfAIReview(repo *sql.DB, artistID, submissionID, judgeName string, score float64, cfg *config.Config) error {
	data := models.NotificationData{
		Type:  models.NotificationTypeAIReview,
		Title: fmt.Sprintf("%s has judged your doodle", judgeName),
		Body:  fmt.Sprintf("%s/%d. Come hear what %s has to say.", strconv.FormatFloat(score, 'f', -1, 64), models.AIScoreMax, judgeName),
		// The app plays the judge's dialogue on open (a review you haven't heard pops up),
		// and that links on to the doodle
		URL:    "/draw",
		Action: "judged",
	}
	return SendNotificationToUser(repo, artistID, data, cfg)
}
