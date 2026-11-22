package queries

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1) // every connection to :memory: is a separate database
	t.Cleanup(func() { db.Close() })

	schema, err := os.ReadFile("../../../migrations/schema.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(schema)); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestGetActivityCounts(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');

		INSERT INTO user_submissions (id, user_id, day) VALUES
			('me-sun', 'me', '2026-11-15'),  -- last week
			('me-mon', 'me', '2026-11-16'),
			('me-sun2', 'me', '2026-11-22'), -- last day of the week
			('me-next', 'me', '2026-11-23'), -- next week
			('pal-tue', 'pal', '2026-11-17');

		INSERT INTO comments (id, submission_id, user_id, text, created_at) VALUES
			(1, 'pal-tue', 'me', 'lol', '2026-11-17 10:00:00'),
			(2, 'me-mon', 'me', 'my own drawing', '2026-11-17 10:00:00'),
			(3, 'me-mon', 'pal', 'nice', '2026-11-17 11:00:00'),
			(4, 'pal-tue', 'me', 'late', '2026-11-23 00:00:00');

		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('me', 'submission', 'pal-tue', 'heart', '2026-11-17 12:00:00'),
			('me', 'submission', 'pal-tue', 'fire', '2026-11-17 12:00:01'),
			('me', 'submission', 'me-mon', 'fire', '2026-11-17 12:00:00'),   -- own drawing
			('pal', 'comment', '1', 'cry-laugh', '2026-11-18 09:00:00'),     -- on my comment
			('pal', 'submission', 'me-mon', 'cry-laugh', '2026-11-22 23:59:59'),
			('pal', 'submission', 'me-sun', 'heart', '2026-11-15 23:59:59'); -- last week

		INSERT INTO achievements (id, image_url, name, description, achievement_field, achievement_value, xp) VALUES
			('a1', '', 'First', 'Draw once', 'SUBMISSION_TOTAL', 1, 25),
			('a2', '', 'Chatty', 'Comment once', 'COMMENT_TOTAL', 1, 40);
		INSERT INTO user_achievements (user_id, achievement_id, created_at) VALUES
			('me', 'a1', '2026-11-15 12:00:00'), -- last week
			('me', 'a2', '2026-11-17 10:00:00');
	`)
	if err != nil {
		t.Fatal(err)
	}

	monday := time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)
	week, err := GetActivityCounts(db, context.Background(), []string{"me", "pal"}, monday, monday.AddDate(0, 0, 7))
	if err != nil {
		t.Fatal(err)
	}

	wantMe := ActivityCounts{
		Drawings:             2,
		ReactionsGiven:       2,
		ReactionsGivenForXP:  2,
		DrawingsReacted:      1,
		CommentsWritten:      1,
		CommentsWrittenForXP: 1,
		ReactionsReceived:    2,
		CryLaughsReceived:    2,
		CommentsReceived:     1, // pal's, not my own
		Achievements:         1,
		AchievementXP:        40,
		QuestsCompleted:      [len(WeeklyQuests)]int{3: 1}, // got a comment
	}
	if week["me"] != wantMe {
		t.Errorf("me this week = %+v, want %+v", week["me"], wantMe)
	}
	events, err := GetXPEventsSince(db, context.Background(), "me", monday)
	if err != nil {
		t.Fatal(err)
	}
	achieved := []string{}
	for _, e := range events {
		if _, ok := AchievementXP(e.Kind); ok {
			achieved = append(achieved, e.Kind)
		}
	}
	if strings.Join(achieved, ",") != "achievement:40" {
		t.Errorf("achievement XP events = %v, want achievement:40", achieved)
	}
	wantPal := ActivityCounts{Drawings: 1, ReactionsGiven: 2, ReactionsGivenForXP: 2, DrawingsReacted: 1, CommentsWritten: 1, CommentsWrittenForXP: 1, ReactionsReceived: 2, CommentsReceived: 1, QuestsCompleted: [len(WeeklyQuests)]int{3: 1}}
	if week["pal"] != wantPal {
		t.Errorf("pal this week = %+v, want %+v", week["pal"], wantPal)
	}

	lifetime, err := GetActivityCounts(db, context.Background(), []string{"me"}, BeginningOfTime, EndOfTime)
	if err != nil {
		t.Fatal(err)
	}
	if got := lifetime["me"]; got.Drawings != 4 || got.CommentsWritten != 2 || got.ReactionsReceived != 3 || got.Achievements != 2 {
		t.Errorf("me lifetime = %+v, want 4 drawings, 2 comments, 3 reactions received, 2 achievements", got)
	}
	if _, ok := lifetime["pal"]; ok {
		t.Error("lifetime counts include a user that was not asked for")
	}
}

func TestGetActivityCountsJudgeScores(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x');
		INSERT INTO user_submissions (id, user_id, day) VALUES
			('a', 'me', '2026-11-16'), ('b', 'me', '2026-11-17'), ('c', 'me', '2026-11-18'),
			('d', 'me', '2026-11-19'), ('e', 'me', '2026-11-23');
		INSERT INTO ai_personalities (id, slug, name, system_prompt) VALUES ('j', 'j', 'Judge', '');
		INSERT INTO ai_reviews (submission_id, personality_id, status, score, updated_at) VALUES
			('a', 'j', 'done', 8.7, '2026-11-16 12:00:00'),
			('b', 'j', 'done', 4.9, '2026-11-17 12:00:00'),    -- under 5: no bonus
			('c', 'j', 'failed', NULL, '2026-11-18 12:00:00'),
			('d', 'j', 'done', 10, '2026-11-19 12:00:00'),
			('e', 'j', 'done', 10, '2026-11-23 12:00:00');     -- next week
	`)
	if err != nil {
		t.Fatal(err)
	}

	monday := time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)
	week, err := GetActivityCounts(db, context.Background(), []string{"me"}, monday, monday.AddDate(0, 0, 7))
	if err != nil {
		t.Fatal(err)
	}
	var want [JudgeScoreSteps]int
	want[37], want[50] = 1, 1
	if got := week["me"].JudgeScores; got != want {
		t.Errorf("judge scores = %v, want an 8.7 and a 10", got)
	}

	events, err := GetXPEventsSince(db, context.Background(), "me", monday)
	if err != nil {
		t.Fatal(err)
	}
	judged := []string{}
	for _, e := range events {
		if _, ok := JudgeScoreIndex(e.Kind); ok {
			judged = append(judged, e.Kind)
		}
	}
	if strings.Join(judged, ",") != "judge87,judge100,judge100" {
		t.Errorf("judged XP events = %v, want judge87, judge100, judge100", judged)
	}
}

// A quest finishes on the step that reaches its goal, and each week starts over
func TestQuestCompletions(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x');
		INSERT INTO user_submissions (id, user_id, day, created_at) VALUES
			('sun', 'me', '2026-11-15', '2026-11-15 09:00:00'), -- last week
			('mon', 'me', '2026-11-16', '2026-11-16 09:00:00'),
			('tue', 'me', '2026-11-17', '2026-11-17 09:00:00'),
			('wed', 'me', '2026-11-18', '2026-11-18 09:00:00'),
			('thu', 'me', '2026-11-19', '2026-11-19 09:00:00'),
			('fri', 'me', '2026-11-20', '2026-11-20 09:00:00'), -- fifth this week
			('sat', 'me', '2026-11-21', '2026-11-21 09:00:00'),
			('m2', 'me', '2026-11-23', '2026-11-23 09:00:00'),  -- next week, one of five
			('t2', 'me', '2026-11-24', '2026-11-24 09:00:00');
	`)
	if err != nil {
		t.Fatal(err)
	}

	counts, err := GetActivityCounts(db, context.Background(), []string{"me"}, BeginningOfTime, EndOfTime)
	if err != nil {
		t.Fatal(err)
	}
	if got := counts["me"].QuestsCompleted; got != [len(WeeklyQuests)]int{1} {
		t.Errorf("quests completed = %v, want draw-5 once", got)
	}

	// Split at the fifth drawing, the finish lands after it
	split := time.Date(2026, 11, 20, 9, 0, 0, 0, time.UTC)
	before, err := GetActivityCounts(db, context.Background(), []string{"me"}, BeginningOfTime, split)
	if err != nil {
		t.Fatal(err)
	}
	if got := before["me"].QuestsCompleted; got != [len(WeeklyQuests)]int{} {
		t.Errorf("quests completed before the fifth drawing = %v, want none", got)
	}
	events, err := GetXPEventsSince(db, context.Background(), "me", split)
	if err != nil {
		t.Fatal(err)
	}
	quests := []XPEvent{}
	for _, e := range events {
		if _, ok := QuestIndex(e.Kind); ok {
			quests = append(quests, e)
		}
	}
	if len(quests) != 1 || quests[0].Kind != "quest:draw-5" || !quests[0].At.Equal(split) {
		t.Errorf("quest XP events = %v, want quest:draw-5 at %v", quests, split)
	}
	for i := 1; i < len(events); i++ {
		if events[i].At.Before(events[i-1].At) {
			t.Errorf("XP events out of order: %v", events)
		}
	}
}

// Quests finished before QuestsStartWeek, when there were no quests, don't count
func TestQuestsBeforeLaunchDontCount(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO user_submissions (id, user_id, day, created_at) VALUES
			('old', 'me', '2026-11-12', '2026-11-12 09:00:00'), -- the week before launch
			('new', 'me', '2026-11-16', '2026-11-16 09:00:00'); -- launch week
		INSERT INTO comments (submission_id, user_id, text, created_at) VALUES
			('old', 'pal', 'nice', '2026-11-12 10:00:00'),
			('new', 'pal', 'nice', '2026-11-16 10:00:00');
	`)
	if err != nil {
		t.Fatal(err)
	}

	counts, err := GetActivityCounts(db, context.Background(), []string{"me"}, BeginningOfTime, EndOfTime)
	if err != nil {
		t.Fatal(err)
	}
	if got := counts["me"].QuestsCompleted; got != [len(WeeklyQuests)]int{3: 1} {
		t.Errorf("quests completed = %v, want get-comment once, in launch week", got)
	}
}

// Only the first ReactionsGivenXPPerDay reactions of a day earn XP, however the day is
// split between counts and XP events
func TestReactionsGivenForXPCapsEachDay(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO user_submissions (id, user_id, day) VALUES ('pal-d', 'pal', '2026-11-17');
		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('me', 'submission', 'pal-d', 'r1', '2026-11-17 10:00:00'),
			('me', 'submission', 'pal-d', 'r2', '2026-11-17 10:00:01'),
			('me', 'submission', 'pal-d', 'r3', '2026-11-17 10:00:02'),
			('me', 'submission', 'pal-d', 'r4', '2026-11-17 10:00:03'),
			('me', 'submission', 'pal-d', 'r5', '2026-11-17 10:00:04'),
			('me', 'submission', 'pal-d', 'r6', '2026-11-17 10:00:05'),
			('me', 'submission', 'pal-d', 'r7', '2026-11-17 10:00:06'),
			('me', 'submission', 'pal-d', 'r8', '2026-11-18 10:00:00'); -- a new day
	`)
	if err != nil {
		t.Fatal(err)
	}

	lifetime, err := GetActivityCounts(db, context.Background(), []string{"me"}, BeginningOfTime, EndOfTime)
	if err != nil {
		t.Fatal(err)
	}
	if got := lifetime["me"]; got.ReactionsGiven != 8 || got.ReactionsGivenForXP != ReactionsGivenXPPerDay+1 {
		t.Errorf("me lifetime = %d reactions, %d for XP; want 8, %d", got.ReactionsGiven, got.ReactionsGivenForXP, ReactionsGivenXPPerDay+1)
	}

	// Split mid-day: the counts before plus the events after still add up to the cap
	split := time.Date(2026, 11, 17, 10, 0, 2, 0, time.UTC)
	before, err := GetActivityCounts(db, context.Background(), []string{"me"}, BeginningOfTime, split)
	if err != nil {
		t.Fatal(err)
	}
	events, err := GetXPEventsSince(db, context.Background(), "me", split)
	if err != nil {
		t.Fatal(err)
	}
	given := 0
	for _, e := range events {
		if e.Kind == "reactionsGiven" {
			given++
		}
	}
	if total := before["me"].ReactionsGivenForXP + given; total != ReactionsGivenXPPerDay+1 {
		t.Errorf("before %d + events %d = %d reactions for XP, want %d", before["me"].ReactionsGivenForXP, given, total, ReactionsGivenXPPerDay+1)
	}
}

func TestCommentsWrittenForXPCapsEachDay(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO user_submissions (id, user_id, day) VALUES ('pal-d', 'pal', '2026-11-17'), ('me-d', 'me', '2026-11-17');
		INSERT INTO comments (user_id, submission_id, text, created_at) VALUES
			('me', 'pal-d', '1', '2026-11-17 10:00:00'),
			('me', 'pal-d', '2', '2026-11-17 10:00:01'),
			('me', 'me-d', 'own drawing', '2026-11-17 10:00:02'),
			('me', 'pal-d', '3', '2026-11-17 10:00:03'),
			('me', 'pal-d', '4', '2026-11-17 10:00:04'),
			('me', 'pal-d', '5', '2026-11-17 10:00:05'),
			('me', 'pal-d', '6', '2026-11-17 10:00:06'),
			('me', 'pal-d', '7', '2026-11-18 10:00:00'); -- a new day
	`)
	if err != nil {
		t.Fatal(err)
	}

	lifetime, err := GetActivityCounts(db, context.Background(), []string{"me"}, BeginningOfTime, EndOfTime)
	if err != nil {
		t.Fatal(err)
	}
	if got := lifetime["me"]; got.CommentsWritten != 7 || got.CommentsWrittenForXP != CommentsWrittenXPPerDay+1 {
		t.Errorf("me lifetime = %d comments, %d for XP; want 7, %d", got.CommentsWritten, got.CommentsWrittenForXP, CommentsWrittenXPPerDay+1)
	}

	// Split mid-day: the counts before plus the events after still add up to the cap
	split := time.Date(2026, 11, 17, 10, 0, 3, 0, time.UTC)
	before, err := GetActivityCounts(db, context.Background(), []string{"me"}, BeginningOfTime, split)
	if err != nil {
		t.Fatal(err)
	}
	events, err := GetXPEventsSince(db, context.Background(), "me", split)
	if err != nil {
		t.Fatal(err)
	}
	written := 0
	for _, e := range events {
		if e.Kind == "commentsWritten" {
			written++
		}
	}
	if total := before["me"].CommentsWrittenForXP + written; total != CommentsWrittenXPPerDay+1 {
		t.Errorf("before %d + events %d = %d comments for XP, want %d", before["me"].CommentsWrittenForXP, written, total, CommentsWrittenXPPerDay+1)
	}
}

func TestGetActivityCountsNoUsers(t *testing.T) {
	counts, err := GetActivityCounts(newTestDB(t), context.Background(), nil, BeginningOfTime, EndOfTime)
	if err != nil || len(counts) != 0 {
		t.Fatalf("got %v, %v; want empty map", counts, err)
	}
}

// A server east of UTC starts its week before UTC does: Monday 00:00 in UTC+9 is
// Sunday 15:00 UTC, which is when reactions start counting.
func TestGetActivityCountsConvertsWeekToUTC(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO user_submissions (id, user_id, day) VALUES ('pal-mon', 'pal', '2026-11-16');
		INSERT INTO reactions (user_id, content_type, content_id, reaction_id, created_at) VALUES
			('me', 'submission', 'pal-mon', 'heart', '2026-11-15 14:59:59'), -- Sunday 23:59 local
			('me', 'submission', 'pal-mon', 'fire', '2026-11-15 15:00:00');  -- Monday 00:00 local
	`)
	if err != nil {
		t.Fatal(err)
	}

	tokyo := time.FixedZone("UTC+9", 9*60*60)
	monday := time.Date(2026, 11, 16, 0, 0, 0, 0, tokyo)
	week, err := GetActivityCounts(db, context.Background(), []string{"me", "pal"}, monday, monday.AddDate(0, 0, 7))
	if err != nil {
		t.Fatal(err)
	}
	if got := week["me"].ReactionsGiven; got != 1 {
		t.Errorf("reactions given this week = %d, want 1", got)
	}
	if got := week["pal"].Drawings; got != 1 {
		t.Errorf("pal's drawings this week = %d, want 1", got)
	}
}

func TestActiveStreak(t *testing.T) {
	// 7pm in Los Angeles is already the next day in UTC; streaks follow the server's clock
	la := time.FixedZone("UTC-8", -8*60*60)
	now := time.Date(2026, 11, 18, 19, 0, 0, 0, la)

	tests := []struct {
		name string
		days []string
		want int
	}{
		{"none", nil, 0},
		{"drew today", []string{"2026-11-18", "2026-11-17", "2026-11-16", "2026-11-14"}, 3},
		{"today not in yet", []string{"2026-11-17", "2026-11-16"}, 2},
		{"missed yesterday", []string{"2026-11-16", "2026-11-15"}, 0},
	}
	for _, tt := range tests {
		if got := activeStreak(tt.days, now); got != tt.want {
			t.Errorf("%s: activeStreak = %d, want %d", tt.name, got, tt.want)
		}
	}
}

func TestBackdateAchievementsMigration(t *testing.T) {
	db := newTestDB(t)
	_, err := db.Exec(`
		INSERT INTO users (id, username, email) VALUES ('me', 'me', 'me@x'), ('pal', 'pal', 'pal@x');
		INSERT INTO user_submissions (id, user_id, day) VALUES
			('d1', 'me', '2026-01-01'), ('d2', 'me', '2026-01-05'),
			('d3', 'me', '2026-01-06'), ('d4', 'me', '2026-01-07');
		INSERT INTO comments (id, submission_id, user_id, text, created_at) VALUES
			(1, 'd1', 'pal', 'hi', '2026-02-01 09:30:00');
		INSERT INTO achievements (id, image_url, name, description, achievement_field, achievement_value) VALUES
			('first', '', '', '', 'SUBMISSION_TOTAL', 1),
			('streak3', '', '', '', 'SUBMISSION_STREAK', 3),
			('chat', '', '', '', 'COMMENT_TOTAL', 1),
			('ten', '', '', '', 'SUBMISSION_TOTAL', 10);
		INSERT INTO user_achievements (user_id, achievement_id, created_at) VALUES
			('me', 'first', '2026-11-18 20:00:00'),
			('me', 'streak3', '2026-11-18 20:00:00'),
			('pal', 'chat', '2026-01-15 00:00:00'), -- already earlier than its comment: kept
			('me', 'ten', '2026-11-18 20:00:00');   -- goal never reached: kept
	`)
	if err != nil {
		t.Fatal(err)
	}

	migration, err := os.ReadFile("../../../migrations/1795035046_backdate_achievements.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	for range 2 { // re-running changes nothing
		if _, err := db.Exec(string(migration)); err != nil {
			t.Fatal(err)
		}
	}

	want := map[string]string{
		"me/first":   "2026-01-01 12:00:00",
		"me/streak3": "2026-01-07 12:00:00",
		"pal/chat":   "2026-01-15 00:00:00",
		"me/ten":     "2026-11-18 20:00:00",
	}
	for key, at := range want {
		var got string
		err := db.QueryRow(`SELECT strftime('%Y-%m-%d %H:%M:%S', created_at) FROM user_achievements
			WHERE user_id || '/' || achievement_id = ?`, key).Scan(&got)
		if err != nil {
			t.Fatal(err)
		}
		if got != at {
			t.Errorf("%s unlocked at %s, want %s", key, got, at)
		}
	}
}
