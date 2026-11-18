// Package events holds the date logic for limited-time events. Days are UTC days,
// matching the frontend's daily countdown to the next UTC midnight.
package events

import (
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"log"
	"time"
)

// ActiveEvent is the JSON shape of an event that is live right now.
type ActiveEvent struct {
	Slug     string    `json:"slug"`
	Name     string    `json:"name"`
	Theme    string    `json:"theme"`
	StartsAt time.Time `json:"startsAt"`
	EndsAt   time.Time `json:"endsAt"` // Exclusive
	// DayNumber is the 1-based UTC day of the event (1 on the start day).
	DayNumber int `json:"dayNumber"`
	// CountdownDays is the length of the "day N of X" countdown, or nil if the event has none.
	CountdownDays *int `json:"countdownDays"`
	// DaysUntilCountdownEnd is 0 on the last countdown day and afterwards; nil if there is no countdown.
	DaysUntilCountdownEnd *int `json:"daysUntilCountdownEnd"`
}

// NewActiveEvent builds the response for an event that is active at `now`.
func NewActiveEvent(event models.Event, now time.Time) ActiveEvent {
	dayNumber := DayNumber(event.StartsAt, now)

	var daysUntilCountdownEnd *int
	if event.CountdownDays != nil {
		days := max(*event.CountdownDays-dayNumber, 0)
		daysUntilCountdownEnd = &days
	}

	return ActiveEvent{
		Slug:                  event.Slug,
		Name:                  event.Name,
		Theme:                 event.Theme,
		StartsAt:              event.StartsAt.UTC(),
		EndsAt:                event.EndsAt.UTC(),
		DayNumber:             dayNumber,
		CountdownDays:         event.CountdownDays,
		DaysUntilCountdownEnd: daysUntilCountdownEnd,
	}
}

// DayNumber returns the 1-based UTC day of an event starting at startsAt that `now` falls on.
func DayNumber(startsAt, now time.Time) int {
	return int(startOfUTCDay(now).Sub(startOfUTCDay(startsAt))/(24*time.Hour)) + 1
}

func startOfUTCDay(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// Now returns the current UTC time used to decide which event is active. Outside production,
// EVENTS_FAKE_NOW (YYYY-MM-DD or RFC3339) overrides it so themed UI can be QA'd ahead of time.
func Now(cfg *config.Config) time.Time {
	if cfg.Env != "production" && cfg.EventsFakeNow != "" {
		fakeNow, err := ParseFakeNow(cfg.EventsFakeNow)
		if err == nil {
			return fakeNow
		}
		log.Printf("Ignoring invalid EVENTS_FAKE_NOW %q: %v", cfg.EventsFakeNow, err)
	}
	return time.Now().UTC()
}

// ParseFakeNow parses a YYYY-MM-DD date (as UTC midnight) or an RFC3339 timestamp.
func ParseFakeNow(value string) (time.Time, error) {
	if t, err := time.Parse(utils.DateFormat, value); err == nil {
		return t, nil
	}
	t, err := time.Parse(time.RFC3339, value)
	return t.UTC(), err
}
