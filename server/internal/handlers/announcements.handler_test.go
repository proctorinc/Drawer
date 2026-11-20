package handlers

import "testing"

func TestAnnouncementInput(t *testing.T) {
	ok := AnnouncementInput{Title: " hi ", StartsAt: "2026-11-20T00:00:00Z", ExpiresAt: "2026-12-01T00:00:00Z"}
	a, err := ok.ToAnnouncement()
	if err != nil || a.Title != "hi" || a.Art != "none" {
		t.Fatalf("ToAnnouncement(%+v) = %+v, %v", ok, a, err)
	}

	for name, in := range map[string]AnnouncementInput{
		"no title":           {StartsAt: ok.StartsAt, ExpiresAt: ok.ExpiresAt},
		"unknown art":        {Title: "x", Art: "dragons", StartsAt: ok.StartsAt, ExpiresAt: ok.ExpiresAt},
		"image without url":  {Title: "x", Art: "image", StartsAt: ok.StartsAt, ExpiresAt: ok.ExpiresAt},
		"label without link": {Title: "x", CTALabel: "go", StartsAt: ok.StartsAt, ExpiresAt: ok.ExpiresAt},
		"unsafe link":        {Title: "x", CTALabel: "go", CTAURL: "javascript:alert(1)", StartsAt: ok.StartsAt, ExpiresAt: ok.ExpiresAt},
		"expires first":      {Title: "x", StartsAt: ok.ExpiresAt, ExpiresAt: ok.StartsAt},
		"bad time":           {Title: "x", StartsAt: "tomorrow", ExpiresAt: ok.ExpiresAt},
	} {
		if _, err := in.ToAnnouncement(); err == nil {
			t.Errorf("%s: want an error", name)
		}
	}
}
