package stats

import (
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/events"
	"testing"
	"time"
)

func TestCountDays(t *testing.T) {
	countdown := 29
	event := models.Event{
		StartsAt:      time.Date(2026, 11, 27, 0, 0, 0, 0, time.UTC),
		EndsAt:        time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC),
		CountdownDays: &countdown,
	}
	days := events.Days(event)
	doodled := []string{"2026-11-27", "2026-11-28", "2026-12-24", "2026-12-25", "2026-12-27", "2026-12-31"}

	for field, want := range map[StatsField]int{
		EVENT_FIRST_DAY:             1,
		EVENT_CHRISTMAS_EVE:         1,
		EVENT_AFTER_CHRISTMAS_TOTAL: 2, // the 27th and 31st; Christmas Day is the countdown's last
		EVENT_STREAK:                2,
	} {
		if got := countDays(field, event, days, doodled); got != want {
			t.Errorf("%s = %d, want %d", field, got, want)
		}
	}

	if got := countDays(EVENT_CHRISTMAS_EVE, event, days, []string{"2026-12-23", "2026-12-25"}); got != 0 {
		t.Errorf("Christmas Eve without drawing on it = %d, want 0", got)
	}
}
