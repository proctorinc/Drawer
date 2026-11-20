package handlers

import (
	"net/http"
	"testing"
)

func TestAchievementCatalogKeepsSecrets(t *testing.T) {
	// Doodlemas is live, so its stickers are on the trophy page, but the catalog still
	// keeps every unearned event sticker a mystery
	router, repo := newEventsRouter(t, "2026-12-01")
	router.GET("/user/achievements", HandlerGetMyAchievements)
	router.GET("/user/achievements/all", HandlerGetAchievementCatalog)
	submit(t, repo, "me-1", "me", "2026-12-01")

	byID := func(body map[string]any) map[string]map[string]any {
		out := map[string]map[string]any{}
		for _, a := range body["achievements"].([]any) {
			a := a.(map[string]any)
			out[a["id"].(string)] = a
		}
		return out
	}

	code, body := request(t, router, http.MethodGet, "/user/achievements/all", nil)
	if code != http.StatusOK {
		t.Fatalf("catalog: status %d", code)
	}
	catalog := byID(body)

	firstSnow := catalog["christmas-2026-first-snow"]
	if firstSnow["secret"] != false || firstSnow["name"] != "first snow" {
		t.Errorf("an earned event sticker should be shown: %v", firstSnow)
	}
	claus := catalog["christmas-2026-doodle-claus"]
	if claus["secret"] != true || claus["name"] != "???" || claus["eventSlug"] != nil || claus["reward"] != nil || claus["category"] != "events" {
		t.Errorf("an unearned event sticker should be a mystery: %v", claus)
	}
	perfect := catalog["judge-best-10"]
	if perfect["secret"] != true || perfect["description"] != "" || perfect["achievementValue"] != float64(0) {
		t.Errorf("a hidden achievement should be a mystery: %v", perfect)
	}
	if streak := catalog["streak-14"]; streak["secret"] != false || streak["description"] == "" || streak["category"] != "streaks" {
		t.Errorf("an everyday achievement should say how to earn it: %v", streak)
	}

	// The trophy page still shows the live event's stickers, but not the hidden ones
	_, body = request(t, router, http.MethodGet, "/user/achievements", nil)
	mine := byID(body)
	if mine["christmas-2026-doodle-claus"]["secret"] != false {
		t.Errorf("the live event's sticker should be shown on the trophy page: %v", mine["christmas-2026-doodle-claus"])
	}
	if mine["judge-best-10"]["secret"] != true {
		t.Errorf("hidden achievements stay secret on the trophy page too: %v", mine["judge-best-10"])
	}
}
