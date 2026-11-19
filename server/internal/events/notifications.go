package events

import (
	"drawer-service-backend/internal/db/models"
	"fmt"
	"time"
)

// NotificationKind is a once-per-event broadcast.
type NotificationKind string

const (
	NotificationStart        NotificationKind = "start"
	NotificationCountdownEnd NotificationKind = "countdown_end"
	NotificationEnd          NotificationKind = "end"
)

// DueNotifications returns the broadcasts that belong to `now`: the start on the event's
// first day, the countdown end on its last countdown day, and the end during the day after
// EndsAt. A broadcast whose day has passed (e.g. the server was down) is dropped, since its
// "today" wording would be wrong.
func DueNotifications(event models.Event, now time.Time) []NotificationKind {
	due := []NotificationKind{}
	active := !now.Before(event.StartsAt) && now.Before(event.EndsAt)

	if active && DayNumber(event.StartsAt, now) == 1 {
		due = append(due, NotificationStart)
	}
	if active && event.CountdownDays != nil && DayNumber(event.StartsAt, now) == *event.CountdownDays {
		due = append(due, NotificationCountdownEnd)
	}
	if !now.Before(event.EndsAt) && now.Before(event.EndsAt.Add(24*time.Hour)) {
		due = append(due, NotificationEnd)
	}
	return due
}

// NotificationMessage returns the title and body of an event broadcast.
func NotificationMessage(event models.Event, kind NotificationKind) (title, body string) {
	christmas := event.Theme == "christmas"
	switch kind {
	case NotificationStart:
		if christmas && event.CountdownDays != nil {
			return event.Name, fmt.Sprintf("%s starts today 🎄 — day 1 of %d", event.Name, *event.CountdownDays)
		}
		return event.Name, fmt.Sprintf("%s starts today!", event.Name)
	case NotificationCountdownEnd:
		if christmas && event.CountdownDays != nil {
			return event.Name, fmt.Sprintf("Day %d: merry christmas! Hang your last ornament", *event.CountdownDays)
		}
		return event.Name, fmt.Sprintf("It's the last day of the %s countdown!", event.Name)
	default:
		return event.Name, fmt.Sprintf("That's a wrap on %s — see your recap", event.Name)
	}
}
