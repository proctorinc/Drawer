package handlers

import (
	"testing"
	"time"
)

func TestOutOfReach(t *testing.T) {
	day := func(d int) time.Time { return time.Date(2026, 11, d, 15, 0, 0, 0, time.UTC) } // 16th is a Monday
	cases := []struct {
		name      string
		now       time.Time
		drawn     int
		drewToday bool
		want      bool
	}{
		{"monday, nothing yet", day(16), 0, false, false},
		{"wednesday, nothing yet: wed-sun is five", day(18), 0, false, false},
		{"thursday, nothing yet", day(19), 0, false, true},
		{"thursday, drew twice before today", day(19), 2, false, false},
		{"thursday, drew today only: fri-sun make four", day(19), 1, true, true},
		{"thursday, drew today and once before", day(19), 2, true, false},
		{"sunday, four done, not today", day(22), 4, false, false},
		{"sunday, three done", day(22), 3, false, true},
		{"done is never out of reach", day(22), 5, true, false},
		{"week across new year", time.Date(2026, 12, 31, 9, 0, 0, 0, time.UTC), 1, false, false},
	}
	for _, c := range cases {
		quests := []Quest{{ID: "draw-5", Progress: c.drawn, Goal: 5}, {ID: "react-3", Goal: 3}}
		outOfReach(quests, c.now, c.drewToday)
		if quests[0].OutOfReach != c.want || quests[1].OutOfReach {
			t.Errorf("%s: out of reach = %v (react-3 %v), want %v", c.name, quests[0].OutOfReach, quests[1].OutOfReach, c.want)
		}
		event := []Quest{{ID: "event-draw-5", Progress: c.drawn, Goal: 5}}
		outOfReach(event, c.now, c.drewToday)
		if event[0].OutOfReach != c.want {
			t.Errorf("%s (event): out of reach = %v, want %v", c.name, event[0].OutOfReach, c.want)
		}
	}
}
