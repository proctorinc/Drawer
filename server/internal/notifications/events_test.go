package notifications

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"testing"
	"time"
)

func TestSendDueEventNotificationsOnce(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()

	var sent []models.NotificationData
	broadcast := func(_ context.Context, data models.NotificationData) error {
		sent = append(sent, data)
		return nil
	}
	run := func(now string) {
		t.Helper()
		at, _ := time.Parse(time.RFC3339, now)
		if err := SendDueEventNotifications(ctx, repo, at, broadcast); err != nil {
			t.Fatal(err)
		}
	}

	run("2026-11-26T23:00:00Z") // before the event
	if len(sent) != 0 {
		t.Fatalf("sent %d before the event", len(sent))
	}

	// Hourly ticks (and restarts) during day 1 send the start broadcast once.
	run("2026-11-27T00:05:00Z")
	run("2026-11-27T01:05:00Z")
	run("2026-11-27T23:05:00Z")
	if len(sent) != 1 || sent[0].Body != "Doodlemas starts today 🎄 — day 1 of 29" || sent[0].Type != models.NotificationTypeEvent {
		t.Fatalf("after day 1: %+v", sent)
	}

	run("2026-12-25T10:00:00Z")
	run("2026-12-25T11:00:00Z")
	run("2027-01-01T00:05:00Z")
	run("2027-01-01T01:05:00Z")
	if len(sent) != 3 ||
		sent[1].Body != "Day 29: merry christmas! Hang your last ornament" ||
		sent[2].Body != "That's a wrap on Doodlemas — see your recap" {
		t.Fatalf("after the event: %+v", sent)
	}

	var markers int
	repo.QueryRow(`SELECT COUNT(*) FROM event_notifications_sent`).Scan(&markers)
	if markers != 3 {
		t.Errorf("got %d sent markers, want 3", markers)
	}
}
