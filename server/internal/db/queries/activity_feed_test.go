package queries

import (
	"context"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"slices"
	"testing"
	"time"
)

func usernames(users []models.User) []string {
	names := []string{}
	for _, u := range users {
		names = append(names, u.Username)
	}
	return names
}

func TestGetActivityFeed(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES
			('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x'), ('bud', 'bud', 'bud@x'),
			('cat', 'cat', 'cat@x'), ('stranger', 'stranger', 'stranger@x');
		INSERT INTO daily_prompts (day, colors, prompt) VALUES
			('2026-11-10', '[]', 'A goalie'), ('2026-11-11', '[]', 'A banana');
		INSERT INTO user_submissions (id, user_id, day) VALUES
			('mine', 'me', '2026-11-10'), ('mine-replied', 'me', '2026-11-11'),
			('cats', 'cat', '2026-11-11'), ('cats-unjoined', 'cat', '2026-11-10');

		INSERT INTO comments (id, submission_id, user_id, text, created_at) VALUES
			-- My drawing: three comments from two people, plus one past the week
			(1, 'mine', 'pal', 'old', datetime('now', '-8 days')),
			(2, 'mine', 'pal', 'nice', datetime('now', '-2 hours')),
			(3, 'mine', 'bud', 'love it', datetime('now', '-1 hours')),
			(4, 'mine', 'pal', 'the goalie!', datetime('now', '-30 minutes')),
			-- My drawing that I already replied on
			(5, 'mine-replied', 'pal', 'hi', datetime('now', '-3 hours')),
			(6, 'mine-replied', 'me', 'thanks', datetime('now', '-2 hours')),
			-- A thread I joined: only what came after my comment counts
			(7, 'cats', 'pal', 'before me', datetime('now', '-5 hours')),
			(8, 'cats', 'me', 'ha', datetime('now', '-4 hours')),
			(9, 'cats', 'bud', 'after me', datetime('now', '-3 hours')),
			(10, 'cats', 'cat', 'thanks all', datetime('now', '-2 hours')),
			-- A thread I never joined
			(11, 'cats-unjoined', 'pal', 'not my business', datetime('now', '-1 hours'));

		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('pal', 'submission', 'mine', 'heart', datetime('now', '-3 hours')),
			('bud', 'submission', 'mine', 'heart', datetime('now', '-2 hours')),
			('bud', 'submission', 'mine', 'fire', datetime('now', '-1 hours')),
			('me', 'submission', 'mine', 'fire', datetime('now', '-1 hours')),
			('pal', 'comment', '8', 'cry-laugh', datetime('now', '-90 minutes')),
			('pal', 'submission', 'cats', 'heart', datetime('now', '-1 hours'));

		INSERT INTO friendships (user1, user2, state, inviter_id, created_at, accepted_at) VALUES
			('me', 'bud', 'pending', 'bud', datetime('now', '-1 days'), NULL),
			('pal', 'me', 'accepted', 'me', datetime('now', '-2 days'), datetime('now', '-1 hours')),
			('me', 'cat', 'accepted', 'me', datetime('now', '-2 days'), NULL),
			('me', 'stranger', 'pending', 'me', datetime('now', '-1 days'), NULL);`)
	if err != nil {
		t.Fatal(err)
	}

	got, err := GetActivityFeed(db, context.Background(), "me", &config.Config{})
	if err != nil {
		t.Fatal(err)
	}
	byID := map[string]models.Activity{}
	for _, a := range got {
		byID[a.ID] = a
	}
	ids := []string{}
	for id := range byID {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	want := []string{"comment-reactions-8", "comments-cats", "comments-mine", "friend-accepted-pal", "friend-request-bud", "reactions-mine"}
	if !slices.Equal(ids, want) {
		t.Fatalf("activity ids = %v, want %v", ids, want)
	}

	if a := byID["comments-mine"]; a.Count != 3 || !slices.Equal(usernames(a.Users), []string{"pal", "bud"}) ||
		a.Comment.Text != "the goalie!" || a.User.ID != "pal" || a.Submission.Prompt != "A goalie" || a.Submission.Artist.ID != "me" {
		t.Errorf("comments on my drawing = %+v", a)
	}
	if a := byID["comments-cats"]; a.Count != 2 || !slices.Equal(usernames(a.Users), []string{"cat", "bud"}) || a.Submission.Artist.ID != "cat" {
		t.Errorf("comments in a thread I joined = %+v", a)
	}
	if a := byID["reactions-mine"]; a.Count != 3 || !slices.Equal(usernames(a.Users), []string{"bud", "pal"}) ||
		!slices.Equal(a.ReactionIDs, []string{"fire", "heart"}) {
		t.Errorf("reactions on my drawing = %+v", a)
	}
	if a := byID["comment-reactions-8"]; a.Count != 1 || a.Comment.Text != "ha" || a.ReactionIDs[0] != "cry-laugh" || a.Submission.ID != "cats" {
		t.Errorf("reactions on my comment = %+v", a)
	}
	if a := byID["friend-request-bud"]; a.Action != models.ActivityActionFriendRequest || a.User.ID != "bud" {
		t.Errorf("friend request = %+v", a)
	}
	if a := byID["friend-accepted-pal"]; a.Action != models.ActivityActionFriendAccepted || a.User.ID != "pal" || a.Date.IsZero() {
		t.Errorf("friend accepted = %+v", a)
	}
}

func TestGetAchievementActivity(t *testing.T) {
	db := newTestDB(t)
	// Days are the server's local days, so pin unlocks to local noons
	y, m, d := time.Now().Date()
	noon := time.Date(y, m, d, 12, 0, 0, 0, time.Local)
	at := func(day int, minutes int) string {
		return noon.AddDate(0, 0, day).Add(time.Duration(minutes) * time.Minute).UTC().Format("2006-01-02 15:04:05")
	}
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES
			('ann', 'ann', 'a@x'), ('bob', 'bob', 'b@x'), ('cat', 'cat', 'c@x'), ('dan', 'dan', 'd@x');
		-- bob is a friend from either side of the row; cat is only invited; dan is a stranger
		INSERT INTO friendships (user1, user2, state, inviter_id) VALUES ('bob', 'ann', 'accepted', 'bob'), ('ann', 'cat', 'pending', 'ann');
		INSERT INTO achievements (id, image_url, name, description, achievement_field, achievement_value) VALUES
			('first', '', 'Baby''s first', 'Draw once', 'SUBMISSION_TOTAL', 1),
			('streak', '', 'Dedicated', 'Draw 5 days running', 'SUBMISSION_STREAK', 5),
			('t5', '', 'Five', '', 'SUBMISSION_TOTAL', 5),
			('t10', '', 'Ten', '', 'SUBMISSION_TOTAL', 10),
			('t20', '', 'Twenty', '', 'SUBMISSION_TOTAL', 20),
			('old', '', 'Old', '', 'SUBMISSION_TOTAL', 50);
		INSERT INTO user_achievements (achievement_id, user_id, created_at) VALUES
			('first', 'cat', datetime('now')), ('first', 'dan', datetime('now')),
			-- Mine each get a row
			('first', 'ann', ?), ('t5', 'ann', ?),
			-- bob's five today fold into one card showing the newest three
			('first', 'bob', ?), ('t5', 'bob', ?), ('t10', 'bob', ?), ('t20', 'bob', ?), ('streak', 'bob', ?),
			-- and two days ago is a card of its own
			('old', 'bob', ?),
			('old', 'ann', datetime('now', '-17 days'));`,
		at(0, -60), at(0, -30), at(0, -5), at(0, -4), at(0, -3), at(0, -2), at(0, -1), at(-2, 0))
	if err != nil {
		t.Fatal(err)
	}

	// Mine and bob's recent unlocks: not non-friends', not the one past the week
	got, err := GetAchievementActivity(db, context.Background(), "ann")
	if err != nil {
		t.Fatal(err)
	}
	byID := map[string]models.Activity{}
	ids := []string{}
	for _, a := range got {
		byID[a.ID] = a
		ids = append(ids, a.ID)
		if a.Achievement == nil || a.Achievement.AchievedAt == nil {
			t.Errorf("achievement = %+v", a.Achievement)
		}
	}
	slices.Sort(ids)
	today := noon.Format("2006-01-02")
	twoDaysAgo := noon.AddDate(0, 0, -2).Format("2006-01-02")
	want := []string{"achievement-ann-first", "achievement-ann-t5", "achievements-bob-" + twoDaysAgo, "achievements-bob-" + today}
	if !slices.Equal(ids, want) {
		t.Fatalf("achievement ids = %v, want %v", ids, want)
	}

	if a := byID["achievement-ann-first"]; a.Achievement.Name != "Baby's first" || a.Count != 0 || a.Achievements != nil {
		t.Errorf("my achievement = %+v", a)
	}
	bobToday := byID["achievements-bob-"+today]
	names := []string{}
	for _, a := range bobToday.Achievements {
		names = append(names, a.Name)
	}
	if bobToday.Count != 5 || !slices.Equal(names, []string{"Dedicated", "Twenty", "Ten"}) ||
		bobToday.Achievement.Name != "Dedicated" || !bobToday.Date.Equal(*bobToday.Achievement.AchievedAt) {
		t.Errorf("bob's day = count %d, achievements %v, newest %+v", bobToday.Count, names, bobToday.Achievement)
	}
	if a := byID["achievements-bob-"+twoDaysAgo]; a.Count != 1 || len(a.Achievements) != 1 || a.Achievement.Name != "Old" {
		t.Errorf("bob's earlier day = %+v", a)
	}
}
