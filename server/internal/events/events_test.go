package events

import (
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"testing"
	"time"
)

func utc(value string) time.Time {
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		panic(err)
	}
	return t
}

func christmasEvent() models.Event {
	countdownDays := 29
	return models.Event{
		Slug:          "christmas-2026",
		Name:          "29 Doodles of Christmas",
		Theme:         "christmas",
		StartsAt:      utc("2026-11-27T00:00:00Z"),
		EndsAt:        utc("2027-01-01T00:00:00Z"),
		CountdownDays: &countdownDays,
	}
}

func TestDayNumber(t *testing.T) {
	start := utc("2026-11-27T00:00:00Z")
	tests := []struct {
		now  string
		want int
	}{
		{"2026-11-27T00:00:00Z", 1},
		{"2026-11-27T23:59:59Z", 1},
		{"2026-11-28T00:00:00Z", 2},
		{"2026-12-25T12:00:00Z", 29},
		{"2026-12-26T00:00:00Z", 30},
		{"2026-12-31T23:59:59Z", 35},
		// A non-UTC "now" is bucketed by its UTC day: 16:30 PST on Nov 27 is 00:30 UTC on Nov 28.
		{"2026-11-27T16:30:00-08:00", 2},
	}
	for _, tt := range tests {
		if got := DayNumber(start, utc(tt.now)); got != tt.want {
			t.Errorf("DayNumber(%s) = %d, want %d", tt.now, got, tt.want)
		}
	}
}

func TestNewActiveEventCountdown(t *testing.T) {
	tests := []struct {
		now                       string
		wantDay, wantDaysUntilEnd int
	}{
		{"2026-11-27T08:00:00Z", 1, 28},
		{"2026-12-24T08:00:00Z", 28, 1},
		{"2026-12-25T08:00:00Z", 29, 0},
		{"2026-12-26T08:00:00Z", 30, 0},
		{"2026-12-31T23:00:00Z", 35, 0},
	}
	for _, tt := range tests {
		got := NewActiveEvent(christmasEvent(), utc(tt.now))
		if got.DayNumber != tt.wantDay {
			t.Errorf("%s: DayNumber = %d, want %d", tt.now, got.DayNumber, tt.wantDay)
		}
		if got.CountdownDays == nil || *got.CountdownDays != 29 {
			t.Errorf("%s: CountdownDays = %v, want 29", tt.now, got.CountdownDays)
		}
		if got.DaysUntilCountdownEnd == nil || *got.DaysUntilCountdownEnd != tt.wantDaysUntilEnd {
			t.Errorf("%s: DaysUntilCountdownEnd = %v, want %d", tt.now, got.DaysUntilCountdownEnd, tt.wantDaysUntilEnd)
		}
	}
}

func TestNewActiveEventWithoutCountdown(t *testing.T) {
	event := christmasEvent()
	event.CountdownDays = nil

	got := NewActiveEvent(event, utc("2026-12-01T00:00:00Z"))
	if got.CountdownDays != nil || got.DaysUntilCountdownEnd != nil {
		t.Errorf("expected nil countdown fields, got %v / %v", got.CountdownDays, got.DaysUntilCountdownEnd)
	}
	if got.DayNumber != 5 {
		t.Errorf("DayNumber = %d, want 5", got.DayNumber)
	}
}

func TestParseFakeNow(t *testing.T) {
	tests := []struct {
		value string
		want  time.Time
	}{
		{"2026-12-05", utc("2026-12-05T00:00:00Z")},
		{"2026-12-05T10:30:00Z", utc("2026-12-05T10:30:00Z")},
		{"2026-12-05T02:00:00-08:00", utc("2026-12-05T10:00:00Z")},
	}
	for _, tt := range tests {
		got, err := ParseFakeNow(tt.value)
		if err != nil || !got.Equal(tt.want) || got.Location() != time.UTC {
			t.Errorf("ParseFakeNow(%q) = %v, %v; want %v in UTC", tt.value, got, err, tt.want)
		}
	}
	if _, err := ParseFakeNow("next tuesday"); err == nil {
		t.Error("expected an error for an invalid value")
	}
}

func TestNowHonorsFakeNowOnlyOutsideProduction(t *testing.T) {
	fake := utc("2026-12-05T00:00:00Z")

	if got := Now(&config.Config{Env: "development", EventsFakeNow: "2026-12-05"}); !got.Equal(fake) {
		t.Errorf("development: Now() = %v, want %v", got, fake)
	}
	if got := Now(&config.Config{Env: "production", EventsFakeNow: "2026-12-05"}); got.Equal(fake) {
		t.Error("production: Now() must ignore EVENTS_FAKE_NOW")
	}
	if got := Now(&config.Config{Env: "development", EventsFakeNow: "garbage"}); got.Equal(time.Time{}) {
		t.Error("invalid EVENTS_FAKE_NOW should fall back to the real time")
	}
}

func TestDays(t *testing.T) {
	event := christmasEvent()
	if got := Days(event); got != (DayRange{First: "2026-11-27", Last: "2026-12-31"}) {
		t.Errorf("Days = %+v", got)
	}
	countdown, ok := CountdownDayRange(event)
	if !ok || countdown != (DayRange{First: "2026-11-27", Last: "2026-12-25"}) {
		t.Errorf("CountdownDayRange = %+v, %v", countdown, ok)
	}

	// An end time after midnight includes that day.
	event.EndsAt = utc("2027-01-01T12:00:00Z")
	if got := Days(event).Last; got != "2027-01-01" {
		t.Errorf("Days.Last with a midday end = %s", got)
	}

	// A countdown longer than the event is capped to its last day.
	long := 400
	event.CountdownDays = &long
	if countdown, _ := CountdownDayRange(event); countdown.Last != "2027-01-01" {
		t.Errorf("capped countdown Last = %s", countdown.Last)
	}

	event.CountdownDays = nil
	if _, ok := CountdownDayRange(event); ok {
		t.Error("expected no countdown range")
	}
}

func TestNewActiveEventDefaults(t *testing.T) {
	event := christmasEvent()
	event.Reactions = []string{"snowflake", "gift"}
	got := NewActiveEvent(event, utc("2026-12-01T00:00:00Z"))
	if got.Progress.DoodledDays == nil || got.Progress.Count != 0 {
		t.Errorf("Progress = %+v, want empty non-nil days", got.Progress)
	}
	if len(got.Reactions) != 2 {
		t.Errorf("Reactions = %v", got.Reactions)
	}

	event.Reactions = nil
	if got := NewActiveEvent(event, utc("2026-12-01T00:00:00Z")); got.Reactions == nil {
		t.Error("Reactions should serialize as [] rather than null")
	}

	progress := NewProgress([]string{"2026-11-27", "2026-11-28"})
	if progress.Count != 2 {
		t.Errorf("NewProgress count = %d", progress.Count)
	}
}

func TestLongestStreak(t *testing.T) {
	tests := []struct {
		days []string
		want int
	}{
		{nil, 0},
		{[]string{"2026-11-27"}, 1},
		{[]string{"2026-11-27", "2026-11-28", "2026-11-30"}, 2},
		{[]string{"2026-11-27", "2026-11-29", "2026-11-30", "2026-12-01", "2026-12-03"}, 3},
		{[]string{"2026-11-30", "2026-12-01", "2026-12-02"}, 3}, // across a month boundary
	}
	for _, tt := range tests {
		if got := LongestStreak(tt.days); got != tt.want {
			t.Errorf("LongestStreak(%v) = %d, want %d", tt.days, got, tt.want)
		}
	}
}

func TestEventInputValidation(t *testing.T) {
	days := func(n int) *int { return &n }
	valid := EventInput{
		Slug: "spooky-2027", Name: " Spooky ", Theme: "halloween",
		StartsAt: utc("2027-10-29T00:00:00-07:00"), EndsAt: utc("2027-11-01T00:00:00Z"),
		CountdownDays: days(3), Reactions: []string{"pumpkin", "ghost", "pumpkin"},
	}

	event, err := valid.ToEvent()
	if err != nil {
		t.Fatal(err)
	}
	if event.Name != "Spooky" || event.StartsAt.Location() != time.UTC || len(event.Reactions) != 2 {
		t.Errorf("unexpected normalized event %+v", event)
	}

	tests := map[string]func(in *EventInput){
		"bad slug":           func(in *EventInput) { in.Slug = "Spooky 2027" },
		"missing name":       func(in *EventInput) { in.Name = "  " },
		"missing theme":      func(in *EventInput) { in.Theme = "" },
		"missing startsAt":   func(in *EventInput) { in.StartsAt = time.Time{} },
		"ends before starts": func(in *EventInput) { in.EndsAt = in.StartsAt.Add(-time.Hour) },
		"ends at start":      func(in *EventInput) { in.EndsAt = in.StartsAt },
		"zero countdown":     func(in *EventInput) { in.CountdownDays = days(0) },
		"countdown too long": func(in *EventInput) { in.CountdownDays = days(30) },
		"bad reaction id":    func(in *EventInput) { in.Reactions = []string{"Snow Flake"} },
	}
	for name, mutate := range tests {
		in := valid
		mutate(&in)
		if _, err := in.ToEvent(); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}

	noCountdown := valid
	noCountdown.CountdownDays = nil
	noCountdown.Reactions = nil
	if event, err := noCountdown.ToEvent(); err != nil || event.Reactions == nil {
		t.Errorf("nil countdown/reactions: %+v, %v", event, err)
	}
}
