package notifications

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"log"
	"time"
)

const eventNotifierInterval = time.Hour

// StartEventNotifier checks hourly (and once at startup) for event broadcasts that are due and
// sends each one at most once. Outside production it only runs when EVENT_NOTIFICATIONS_ENABLED
// is set, so dev and staging servers don't push to real subscribers.
func StartEventNotifier(cfg *config.Config, repo *sql.DB) {
	if cfg.Env != "production" && !cfg.EventsNotify {
		log.Println("Event notifications disabled outside production (set EVENT_NOTIFICATIONS_ENABLED=true to enable)")
		return
	}

	broadcast := func(ctx context.Context, data models.NotificationData) error {
		userIDs, err := queries.GetPushSubscribedUserIDs(repo, ctx)
		if err != nil {
			return err
		}
		for _, userID := range userIDs {
			if err := SendNotificationToUser(repo, userID, data, cfg); err != nil {
				log.Printf("Failed to send event notification to user %s: %v", userID, err)
			}
		}
		return nil
	}

	go func() {
		ticker := time.NewTicker(eventNotifierInterval)
		defer ticker.Stop()
		for {
			if err := SendDueEventNotifications(context.Background(), repo, events.Now(cfg), broadcast); err != nil {
				log.Printf("Error sending event notifications: %v", err)
			}
			<-ticker.C
		}
	}()
}

// SendDueEventNotifications broadcasts every event notification due at `now` that hasn't been
// sent yet. The "sent" marker is claimed before sending, so a crash mid-send never resends.
func SendDueEventNotifications(ctx context.Context, repo *sql.DB, now time.Time,
	broadcast func(context.Context, models.NotificationData) error) error {
	allEvents, err := queries.ListEvents(repo, ctx)
	if err != nil {
		return err
	}

	for _, event := range allEvents {
		for _, kind := range events.DueNotifications(event, now) {
			claimed, err := queries.ClaimEventNotification(repo, ctx, event.ID, string(kind))
			if err != nil {
				return err
			}
			if !claimed {
				continue
			}

			title, body := events.NotificationMessage(event, kind)
			log.Printf("Sending event notification %s/%s: %s", event.Slug, kind, body)
			err = broadcast(ctx, models.NotificationData{
				Type:   models.NotificationTypeEvent,
				Title:  title,
				Body:   body,
				URL:    "/draw",
				Action: string(kind),
			})
			if err != nil {
				log.Printf("Failed to broadcast event notification %s/%s: %v", event.Slug, kind, err)
			}
		}
	}
	return nil
}
