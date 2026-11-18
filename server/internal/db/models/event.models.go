package models

import "time"

// Event is a limited-time event (e.g. a holiday theme), active while StartsAt <= now < EndsAt.
type Event struct {
	ID            string
	Slug          string
	Name          string
	Theme         string
	StartsAt      time.Time
	EndsAt        time.Time
	CountdownDays *int     // Optional length of a "day N of X" countdown, counted from StartsAt
	Reactions     []string // Extra reaction ids allowed only while the event is active
}
