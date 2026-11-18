package events

import (
	"drawer-service-backend/internal/db/models"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

var (
	slugPattern       = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	reactionIdPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
)

// EventInput is the admin create/update request body.
type EventInput struct {
	Slug          string    `json:"slug"`
	Name          string    `json:"name"`
	Theme         string    `json:"theme"`
	StartsAt      time.Time `json:"startsAt"`
	EndsAt        time.Time `json:"endsAt"` // Exclusive
	CountdownDays *int      `json:"countdownDays"`
	Reactions     []string  `json:"reactions"`
}

// ToEvent validates the input and returns it as an event (without an ID), in UTC with
// trimmed text and de-duplicated reactions.
func (in EventInput) ToEvent() (models.Event, error) {
	event := models.Event{
		Slug:          strings.TrimSpace(in.Slug),
		Name:          strings.TrimSpace(in.Name),
		Theme:         strings.TrimSpace(in.Theme),
		StartsAt:      in.StartsAt.UTC().Truncate(time.Second),
		EndsAt:        in.EndsAt.UTC().Truncate(time.Second),
		CountdownDays: in.CountdownDays,
		Reactions:     []string{},
	}

	if !slugPattern.MatchString(event.Slug) {
		return models.Event{}, errors.New("slug must be lowercase letters, numbers and dashes")
	}
	if event.Name == "" || event.Theme == "" {
		return models.Event{}, errors.New("name and theme are required")
	}
	if in.StartsAt.IsZero() || in.EndsAt.IsZero() {
		return models.Event{}, errors.New("startsAt and endsAt are required")
	}
	if !event.EndsAt.After(event.StartsAt) {
		return models.Event{}, errors.New("endsAt must be after startsAt")
	}
	if event.CountdownDays != nil {
		totalDays := DayNumber(event.StartsAt, event.EndsAt.Add(-time.Nanosecond))
		if *event.CountdownDays < 1 || *event.CountdownDays > totalDays {
			return models.Event{}, fmt.Errorf("countdownDays must be between 1 and %d (the event's length in days)", totalDays)
		}
	}

	seen := map[string]bool{}
	for _, reaction := range in.Reactions {
		if !reactionIdPattern.MatchString(reaction) {
			return models.Event{}, fmt.Errorf("invalid reaction id %q", reaction)
		}
		if !seen[reaction] {
			seen[reaction] = true
			event.Reactions = append(event.Reactions, reaction)
		}
	}

	return event, nil
}
