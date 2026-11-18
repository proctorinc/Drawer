package handlers

import (
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"testing"
	"time"
)

func TestLevelForXP(t *testing.T) {
	tests := []struct {
		xp   int
		want Level
	}{
		{0, Level{Level: 1, XP: 0, LevelStartXP: 0, NextLevelXP: 50}},
		{49, Level{Level: 1, XP: 49, LevelStartXP: 0, NextLevelXP: 50}},
		{50, Level{Level: 2, XP: 50, LevelStartXP: 50, NextLevelXP: 150}},
		{150, Level{Level: 3, XP: 150, LevelStartXP: 150, NextLevelXP: 300}},
		{299, Level{Level: 3, XP: 299, LevelStartXP: 150, NextLevelXP: 300}},
	}
	for _, tt := range tests {
		if got := levelForXP(tt.xp); got != tt.want {
			t.Errorf("levelForXP(%d) = %+v, want %+v", tt.xp, got, tt.want)
		}
	}
}

func TestWeekBounds(t *testing.T) {
	la := time.FixedZone("UTC-8", -8*60*60)
	tests := []struct{ now, start, next string }{
		{"2026-11-16 00:00", "2026-11-16", "2026-11-23"}, // Monday
		{"2026-11-18 15:30", "2026-11-16", "2026-11-23"}, // Wednesday
		{"2026-11-22 23:59", "2026-11-16", "2026-11-23"}, // Sunday
		{"2026-01-01 12:00", "2025-12-29", "2026-01-05"}, // across a year
	}
	for _, tt := range tests {
		now, _ := time.ParseInLocation("2006-01-02 15:04", tt.now, la)
		start, next := weekBounds(now)
		got := []string{start.Format("2006-01-02 15:04"), next.Format("2006-01-02 15:04")}
		if got[0] != tt.start+" 00:00" || got[1] != tt.next+" 00:00" || start.Location() != la {
			t.Errorf("weekBounds(%s) = %v in %v; want local midnights %s, %s", tt.now, got, start.Location(), tt.start, tt.next)
		}
	}
}

func TestLeaderboardSortsByXPThenName(t *testing.T) {
	users := []models.User{{ID: "1", Username: "zed"}, {ID: "2", Username: "amy"}, {ID: "3", Username: "bob"}}
	weekly := map[string]queries.ActivityCounts{"1": {Drawings: 1}, "3": {Drawings: 1}}

	got := leaderboard(users, weekly)

	order := []string{got[0].User.Username, got[1].User.Username, got[2].User.Username}
	if order[0] != "bob" || order[1] != "zed" || order[2] != "amy" {
		t.Errorf("leaderboard order = %v, want [bob zed amy]", order)
	}
	if got[0].XP != xpPerDrawing || got[2].XP != 0 {
		t.Errorf("leaderboard XP = %d, %d; want %d, 0", got[0].XP, got[2].XP, xpPerDrawing)
	}
}

func TestXPCountsAchievements(t *testing.T) {
	got := xpFor(queries.ActivityCounts{Drawings: 1, Achievements: 2})
	if want := xpPerDrawing + 2*xpPerAchievement; got != want {
		t.Errorf("xpFor = %d, want %d", got, want)
	}
}
