package models

import "time"

// The pictures an announcement can show; the app knows how to draw each one.
const (
	AnnouncementArtNone      = "none"
	AnnouncementArtAIJudges  = "ai_judges"
	AnnouncementArtChristmas = "christmas"
	AnnouncementArtImage     = "image"
)

var AnnouncementArts = []string{AnnouncementArtNone, AnnouncementArtAIJudges, AnnouncementArtChristmas, AnnouncementArtImage}

// Announcement is a full-screen "what's new" page. Players see the active ones whose
// window covers now; ExpiresAt is exclusive.
type Announcement struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Art       string    `json:"art"`
	ImageURL  string    `json:"imageUrl"`
	CTALabel  string    `json:"ctaLabel"`
	CTAURL    string    `json:"ctaUrl"`
	Position  int       `json:"position"`
	Active    bool      `json:"active"`
	StartsAt  time.Time `json:"startsAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// PlayerAnnouncement is a live announcement as a player gets it.
type PlayerAnnouncement struct {
	Announcement
	Seen bool `json:"seen"`
}

// AdminAnnouncement is an announcement as admins see it, with how many players have seen it.
type AdminAnnouncement struct {
	Announcement
	SeenBy int `json:"seenBy"`
}
