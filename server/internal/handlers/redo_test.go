package handlers

import (
	"context"
	"drawer-service-backend/internal/db/queries"
	"net/http"
	"testing"
)

// Admins hand out redos; players spend them on prompts they missed.
func TestRedos(t *testing.T) {
	rig := newDailyRig(t)
	d := rig.days // d[0] is today, d[i] is i days ago; bo joined on d[14]
	as := func(who, method, path string, body any) (int, map[string]any) {
		t.Helper()
		return requestAs(t, rig.router, who, method, path, body)
	}
	redos := func(who string) (grants, prompts []any) {
		t.Helper()
		code, body := as(who, "GET", "/submission/redos", nil)
		if code != http.StatusOK {
			t.Fatalf("redos for %s: %d %v", who, code, body)
		}
		return body["grants"].([]any), body["prompts"].([]any)
	}
	grant := func(body map[string]any) int {
		t.Helper()
		code, _ := as("admin", "POST", "/admin/redos", body)
		return code
	}

	// No redos: nothing on offer, and an old prompt is closed
	if g, p := redos("bo"); len(g) != 0 || len(p) != 0 {
		t.Errorf("bo before any redos: %d grants, %d prompts", len(g), len(p))
	}
	if code, _ := rig.submit(t, "bo", d[5]); code != http.StatusConflict {
		t.Errorf("old prompt without a redo: %d, want 409", code)
	}

	// Only finished days can be redone
	// d[29] is the oldest prompt there is, so the day before has none
	for _, day := range []string{d[0], "2999-01-01", "not-a-day", "2000-01-01"} {
		if code := grant(map[string]any{"userId": "bo", "day": day}); code != http.StatusBadRequest {
			t.Errorf("redo for %q: %d, want 400", day, code)
		}
	}
	if code := grant(map[string]any{"userId": "nobody"}); code != http.StatusNotFound {
		t.Errorf("redo for an unknown player: %d, want 404", code)
	}

	// One for d[5], one for d[20] (before bo joined: a particular day can be any day), one for any day
	for _, body := range []map[string]any{
		{"userId": "bo", "day": d[5], "note": "app crashed"},
		{"userId": "bo", "day": d[20]},
		{"userId": "bo", "day": nil},
	} {
		if code := grant(body); code != http.StatusCreated {
			t.Fatalf("granting %v: %d", body, code)
		}
	}
	g, p := redos("bo")
	if len(g) != 3 {
		t.Errorf("bo holds %d redos, want 3", len(g))
	}
	// Every missed day since joining (d[1]..d[14]), plus d[20]
	if len(p) != 15 {
		t.Errorf("bo is offered %d prompts, want 15", len(p))
	}
	if first := p[0].(map[string]any)["day"]; first != d[1] {
		t.Errorf("newest offered prompt is %v, want %s", first, d[1])
	}

	// d[5] spends its own grant, so the any-day one is still there for d[3]
	code, body := rig.submit(t, "bo", d[5])
	if code != http.StatusCreated || body["day"] != d[5] || body["redo"] != true {
		t.Fatalf("redo of d[5]: %d %v", code, body)
	}
	redoID := body["id"].(string)
	if code, _ := rig.submit(t, "bo", d[3]); code != http.StatusCreated {
		t.Fatalf("redo of d[3] with the any-day grant: %d", code)
	}
	if code, _ := rig.submit(t, "bo", d[4]); code != http.StatusConflict {
		t.Errorf("redo of d[4] with only d[20]'s grant left: %d, want 409", code)
	}
	if code, _ := rig.submit(t, "bo", d[5]); code != http.StatusServiceUnavailable {
		t.Errorf("redoing d[5] twice: %d, want 503", code)
	}
	if g, p := redos("bo"); len(g) != 1 || len(p) != 1 || p[0].(map[string]any)["day"] != d[20] {
		t.Errorf("after two redos: %d grants, prompts %v; want just d[20]'s", len(g), p)
	}
	if code, body := as("bo", "GET", "/submission/"+redoID, nil); code != http.StatusOK || body["redo"] != true {
		t.Errorf("the redone drawing: %d redo=%v", code, body["redo"])
	}

	// Admins see every grant, and can take back only unused ones
	if code, _ := requestAsRaw(t, rig, "admin", "GET", "/admin/redos"); code != http.StatusOK {
		t.Fatalf("admin list: %d", code)
	}
	list, err := queries.ListRedoGrants(rig.repo, context.Background(), 10)
	if err != nil || len(list) != 3 {
		t.Fatalf("listing redos: %v, %d grants", err, len(list))
	}
	var unused, used string
	for _, g := range list {
		if g.Username != "bo" {
			t.Errorf("grant for %q, want bo", g.Username)
		}
		if g.UsedAt == nil {
			unused = g.ID
		} else {
			used = g.ID
		}
	}
	if code, _ := as("admin", "DELETE", "/admin/redos/"+used, nil); code != http.StatusConflict {
		t.Errorf("revoking a used redo: %d, want 409", code)
	}
	req := func(id string) int {
		t.Helper()
		code, _ := requestAsRaw(t, rig, "admin", "DELETE", "/admin/redos/"+id)
		return code
	}
	if code := req(unused); code != http.StatusNoContent {
		t.Errorf("revoking an unused redo: %d, want 204", code)
	}
	if g, _ := redos("bo"); len(g) != 0 {
		t.Errorf("after revoking: %d grants left", len(g))
	}
}

// Redone days only count toward streaks once admins say so.
func TestRedosAndStreaks(t *testing.T) {
	rig := newDailyRig(t)
	d := rig.days
	ctx := context.Background()

	if code, _ := rig.submit(t, "amy", ""); code != http.StatusCreated {
		t.Fatalf("today's drawing: %d", code)
	}
	if code, _ := requestAs(t, rig.router, "admin", "POST", "/admin/redos", map[string]any{"userId": "amy"}); code != http.StatusCreated {
		t.Fatalf("granting: %d", code)
	}
	if code, _ := rig.submit(t, "amy", d[1]); code != http.StatusCreated {
		t.Fatalf("redo of yesterday: %d", code)
	}

	streak := func() int {
		t.Helper()
		n, err := queries.CalculateSubmissionActiveStreak(rig.repo, ctx, "amy")
		if err != nil {
			t.Fatal(err)
		}
		return n
	}
	if _, body := requestAs(t, rig.router, "amy", "GET", "/settings", nil); body["redosCountForStreaks"] != false {
		t.Errorf("redos count for streaks by default: %v", body["redosCountForStreaks"])
	}
	if n := streak(); n != 1 {
		t.Errorf("streak with redos not counting: %d, want 1", n)
	}

	code, body := requestAs(t, rig.router, "admin", "PUT", "/admin/settings", map[string]any{"redosCountForStreaks": true})
	if code != http.StatusOK || body["redosCountForStreaks"] != true {
		t.Fatalf("turning redo streaks on: %d %v", code, body)
	}
	if n := streak(); n != 2 {
		t.Errorf("streak with redos counting: %d, want 2", n)
	}
	if n, _ := queries.CalculateSubmissionMaxStreak(rig.repo, ctx, "amy"); n != 2 {
		t.Errorf("best streak with redos counting: %d, want 2", n)
	}
}

// Admins see a player's past prompts since they joined, and how each went.
func TestAdminPlayerDays(t *testing.T) {
	rig := newDailyRig(t)
	d := rig.days // bo joined on d[14]

	if code, _ := rig.submit(t, "bo", ""); code != http.StatusCreated {
		t.Fatalf("today's drawing: %d", code)
	}
	if code, _ := requestAs(t, rig.router, "admin", "POST", "/admin/redos", map[string]any{"userId": "bo", "day": d[3]}); code != http.StatusCreated {
		t.Fatalf("granting: %d", code)
	}
	if code, _ := rig.submit(t, "bo", d[3]); code != http.StatusCreated {
		t.Fatalf("redo of d[3]: %d", code)
	}

	code, body := requestAs(t, rig.router, "admin", "GET", "/admin/users/bo/days", nil)
	if code != http.StatusOK {
		t.Fatalf("bo's days: %d %v", code, body)
	}
	if body["today"] != d[0] {
		t.Errorf("today is %v, want %s", body["today"], d[0])
	}
	days := body["days"].([]any)
	// d[1]..d[14]: today is still open, and nothing before bo joined
	if len(days) != 14 {
		t.Fatalf("bo has %d days, want 14", len(days))
	}
	status := map[string]any{}
	for _, day := range days {
		day := day.(map[string]any)
		status[day["day"].(string)] = day["status"]
	}
	if days[0].(map[string]any)["day"] != d[1] || status[d[3]] != "redo" || status[d[2]] != "missed" {
		t.Errorf("bo's days: newest %v, d[3] %v, d[2] %v", days[0], status[d[3]], status[d[2]])
	}

	if code, _ := requestAs(t, rig.router, "admin", "GET", "/admin/users/nobody/days", nil); code != http.StatusNotFound {
		t.Errorf("an unknown player's days: %d, want 404", code)
	}
}
