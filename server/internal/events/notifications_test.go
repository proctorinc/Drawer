package events

import "testing"

func TestDueNotifications(t *testing.T) {
	tests := []struct {
		now  string
		want []NotificationKind
	}{
		{"2026-11-26T23:00:00Z", []NotificationKind{}},
		{"2026-11-27T00:30:00Z", []NotificationKind{NotificationStart}},
		{"2026-11-27T23:30:00Z", []NotificationKind{NotificationStart}},
		{"2026-11-28T00:30:00Z", []NotificationKind{}},
		{"2026-12-25T09:00:00Z", []NotificationKind{NotificationCountdownEnd}},
		{"2026-12-26T09:00:00Z", []NotificationKind{}},
		{"2027-01-01T00:30:00Z", []NotificationKind{NotificationEnd}},
		{"2027-01-02T00:30:00Z", []NotificationKind{}},
	}
	for _, tt := range tests {
		got := DueNotifications(christmasEvent(), utc(tt.now))
		if len(got) != len(tt.want) || (len(got) > 0 && got[0] != tt.want[0]) {
			t.Errorf("DueNotifications(%s) = %v, want %v", tt.now, got, tt.want)
		}
	}
}

func TestChristmasNotificationMessages(t *testing.T) {
	event := christmasEvent()
	want := map[NotificationKind]string{
		NotificationStart:        "Doodlemas starts today 🎄 — day 1 of 29",
		NotificationCountdownEnd: "Day 29: merry christmas! Hang your last ornament",
		NotificationEnd:          "That's a wrap on Doodlemas — see your recap",
	}
	for kind, wantBody := range want {
		if _, body := NotificationMessage(event, kind); body != wantBody {
			t.Errorf("%s: body = %q, want %q", kind, body, wantBody)
		}
	}
}
