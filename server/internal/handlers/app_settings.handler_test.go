package handlers

import "testing"

func TestNewAppSettingsDefaultsToPencil(t *testing.T) {
	cases := map[string]string{"": "pencil", "kazoo": "pencil", "musical": "musical", "pencil": "pencil"}
	for stored, want := range cases {
		got := newAppSettings(map[string]string{settingPencilSound: stored}).PencilSound
		if got != want {
			t.Errorf("stored %q: got %q, want %q", stored, got, want)
		}
	}
}
