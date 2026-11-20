package queries

import (
	"context"
	"drawer-service-backend/internal/db/dbtest"
	"drawer-service-backend/internal/db/models"
	"testing"
	"time"
)

func liveIDs(t *testing.T, list []models.PlayerAnnouncement) map[string]bool {
	t.Helper()
	ids := map[string]bool{}
	for _, a := range list {
		ids[a.ID] = a.Seen
	}
	return ids
}

func TestAnnouncements(t *testing.T) {
	repo := dbtest.NewEventsDB(t)
	ctx := context.Background()
	if _, err := repo.Exec(`INSERT INTO users (id, username, email) VALUES ('ann', 'ann', 'ann@example.com')`); err != nil {
		t.Fatal(err)
	}

	// The seeded pair are live the week before Doodlemas, in order, and unseen
	before := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	list, err := GetLiveAnnouncements(repo, ctx, "ann", before)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].ID != "announce-ai-judges" || list[1].ID != "announce-doodlemas" {
		t.Fatalf("live announcements = %+v; want the AI judges, then Doodlemas", list)
	}
	if list[0].Seen || list[1].Seen {
		t.Errorf("nothing should be seen yet: %+v", list)
	}

	// Seeing one marks only that one, for only that player; unknown ids are ignored
	if err := MarkAnnouncementsSeen(repo, ctx, "ann", []string{"announce-ai-judges", "nope"}); err != nil {
		t.Fatal(err)
	}
	if err := MarkAnnouncementsSeen(repo, ctx, "ann", []string{"announce-ai-judges"}); err != nil {
		t.Fatalf("seeing it twice: %v", err)
	}
	list, _ = GetLiveAnnouncements(repo, ctx, "ann", before)
	if ids := liveIDs(t, list); !ids["announce-ai-judges"] || ids["announce-doodlemas"] {
		t.Errorf("seen = %v; want only the AI judges", ids)
	}
	list, _ = GetLiveAnnouncements(repo, ctx, "bob", before)
	if ids := liveIDs(t, list); ids["announce-ai-judges"] {
		t.Errorf("bob saw ann's view: %v", ids)
	}

	// Expired ones drop off: after New Year only the AI judges are left, and by spring neither
	list, _ = GetLiveAnnouncements(repo, ctx, "ann", time.Date(2027, 1, 2, 0, 0, 0, 0, time.UTC))
	if ids := liveIDs(t, list); len(ids) != 1 || !ids["announce-ai-judges"] {
		t.Errorf("live in January = %v; want just the AI judges", ids)
	}
	list, _ = GetLiveAnnouncements(repo, ctx, "ann", time.Date(2027, 4, 1, 0, 0, 0, 0, time.UTC))
	if len(list) != 0 {
		t.Errorf("live in April = %+v; want none", list)
	}

	// Drafts don't show; switching one on does, and admins see who's seen what
	draft, err := SaveAnnouncement(repo, ctx, models.Announcement{
		Title: "draft", Art: models.AnnouncementArtNone,
		StartsAt: before.Add(-time.Hour), ExpiresAt: before.Add(time.Hour),
	})
	if err != nil {
		t.Fatal(err)
	}
	list, _ = GetLiveAnnouncements(repo, ctx, "ann", before)
	if _, ok := liveIDs(t, list)[draft.ID]; ok {
		t.Error("an inactive announcement went live")
	}
	draft.Active = true
	if _, err := SaveAnnouncement(repo, ctx, draft); err != nil {
		t.Fatal(err)
	}
	list, _ = GetLiveAnnouncements(repo, ctx, "ann", before)
	if _, ok := liveIDs(t, list)[draft.ID]; !ok {
		t.Error("switching it on didn't make it live")
	}

	all, err := ListAnnouncements(repo, ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range all {
		want := 0
		if a.ID == "announce-ai-judges" {
			want = 1
		}
		if a.SeenBy != want {
			t.Errorf("%s seen by %d; want %d", a.ID, a.SeenBy, want)
		}
	}

	// Resetting shows it again; deleting takes it away
	if err := ResetAnnouncementViews(repo, ctx, "announce-ai-judges"); err != nil {
		t.Fatal(err)
	}
	list, _ = GetLiveAnnouncements(repo, ctx, "ann", before)
	if liveIDs(t, list)["announce-ai-judges"] {
		t.Error("reset didn't make it unseen")
	}
	if err := DeleteAnnouncement(repo, ctx, draft.ID); err != nil {
		t.Fatal(err)
	}
	if err := DeleteAnnouncement(repo, ctx, draft.ID); err == nil {
		t.Error("deleting it twice should say it's gone")
	}
}
