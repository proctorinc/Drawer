package handlers

import (
	"cmp"
	gocontext "context"
	"database/sql"
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"drawer-service-backend/internal/xp"
	"errors"
	"log"
	"maps"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// The XP rules live in the xp package, so achievements can check levels too
const (
	xpPerDrawing          = xp.PerDrawing
	xpPerCommentWritten   = xp.PerCommentWritten
	xpPerReactionGiven    = xp.PerReactionGiven
	xpPerReactionReceived = xp.PerReactionReceived
	xpPerAchievement      = xp.PerAchievement
)

func judgeBonusXP(i int) int { return xp.JudgeBonus(i) }

type XPRule struct {
	Action string `json:"action"`
	XP     int    `json:"xp"`
	// MaxXP is set when the XP varies, from XP up to MaxXP
	MaxXP int `json:"maxXp,omitempty"`
}

// xpRules lists how to earn XP. Achievements are each worth their own XP, so the
// achievement rule spans the catalog's range.
func xpRules(repo *sql.DB, ctx gocontext.Context) ([]XPRule, error) {
	low, high, err := queries.GetAchievementXPRange(repo, ctx)
	if err != nil {
		return nil, err
	}
	return []XPRule{
		{"Draw the daily prompt", xpPerDrawing, 0},
		{"Comment on a friend's drawing", xpPerCommentWritten, 0},
		{"React to a friend", xpPerReactionGiven, 0},
		{"Get a reaction", xpPerReactionReceived, 0},
		xpRange("Complete an achievement", low, high),
		xpRange("Score 5+ with the judge", judgeBonusXP(0), judgeBonusXP(queries.JudgeScoreSteps-1)),
		xpRange("Finish a weekly quest", slices.Min(slices.Collect(maps.Values(xp.QuestBonus))), slices.Max(slices.Collect(maps.Values(xp.QuestBonus)))),
	}, nil
}

// xpRange is a rule worth from low to high, or exactly low when they match
func xpRange(action string, low, high int) XPRule {
	if high == low {
		high = 0
	}
	return XPRule{action, low, high}
}

type Level = xp.Level

type Week struct {
	Start string `json:"start"` // Monday, YYYY-MM-DD
	End   string `json:"end"`   // Sunday, inclusive
	// When the next week starts, so clients in any time zone can count down to it
	ResetsAt time.Time `json:"resetsAt"`
}

type Quest struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Progress    int    `json:"progress"`
	Goal        int    `json:"goal"`
	// XP is the bonus for finishing it this week
	XP int `json:"xp"`
	// OutOfReach is set when there aren't enough days left this week to finish it
	OutOfReach bool `json:"outOfReach,omitempty"`
}

type LeaderboardEntry struct {
	User     models.User `json:"user"`
	XP       int         `json:"xp"`
	Drawings int         `json:"drawings"`
}

type TrophiesResponse struct {
	Level         Level                  `json:"level"`
	CurrentStreak int                    `json:"currentStreak"`
	Lifetime      queries.ActivityCounts `json:"lifetime"`
	Week          Week                   `json:"week"`
	Quests        []Quest                `json:"quests"`
	// QuestsEvent is set while an event is live, when the weekly quests are on its page
	// instead and Quests is empty
	QuestsEvent *EventLink         `json:"questsEvent"`
	Leaderboard []LeaderboardEntry `json:"leaderboard"`
	XPRules     []XPRule           `json:"xpRules"`
}

func HandleGetTrophies(c *gin.Context) {
	requester := middleware.GetUser(c)
	repo := context.GetCtx(c).DB
	ctx := c.Request.Context()

	fail := func(what string, err error) {
		log.Printf("Trophies: error fetching %s for user %s: %v", what, requester.ID, err)
		c.JSON(http.StatusInternalServerError, Error("Failed to load trophies"))
	}

	mine, err := publicTrophies(repo, ctx, requester.ID)
	if err != nil {
		fail("lifetime trophies", err)
		return
	}

	friendIDs, err := queries.GetUserFriends(repo, ctx, requester.ID)
	if err != nil {
		fail("friends", err)
		return
	}
	boardIDs := append([]string{requester.ID}, friendIDs...)

	// Same clock as daily submissions, so a drawing's day lands in the right week
	week, nextWeek := weekBounds(time.Now())
	weekly, err := queries.GetActivityCounts(repo, ctx, []string{requester.ID}, week, nextWeek)
	if err != nil {
		fail("weekly activity", err)
		return
	}
	// The friend board is all-time XP, so nobody feels pressed to grind each week
	allTime, err := queries.GetActivityCounts(repo, ctx, boardIDs, queries.BeginningOfTime, queries.EndOfTime)
	if err != nil {
		fail("leaderboard activity", err)
		return
	}
	users, err := queries.GetUsersByIDs(repo, ctx, boardIDs)
	if err != nil {
		fail("leaderboard users", err)
		return
	}

	quests, questsEvent := weeklyQuests(weekly[requester.ID]), (*EventLink)(nil)
	if err := markOutOfReach(repo, ctx, requester.ID, time.Now(), quests); err != nil {
		fail("today's drawing", err)
		return
	}
	event, err := queries.GetActiveEvent(repo, ctx, events.Now(context.GetCtx(c).Config))
	if err == nil {
		quests, questsEvent = []Quest{}, &EventLink{Slug: event.Slug, Name: event.Name, Theme: event.Theme}
	} else if !errors.Is(err, sql.ErrNoRows) {
		fail("active event", err)
		return
	}
	rules, err := xpRules(repo, ctx)
	if err != nil {
		fail("XP rules", err)
		return
	}

	c.JSON(http.StatusOK, TrophiesResponse{
		Level:         mine.Level,
		CurrentStreak: mine.CurrentStreak,
		Lifetime:      mine.Lifetime,
		Week:          weekOf(week, nextWeek),
		Quests:        quests,
		QuestsEvent:   questsEvent,
		Leaderboard:   leaderboard(users, allTime),
		XPRules:       rules,
	})
}

// PublicTrophies is the part of someone's trophy cabinet shown on their book
type PublicTrophies struct {
	Level         Level                  `json:"level"`
	CurrentStreak int                    `json:"currentStreak"`
	Lifetime      queries.ActivityCounts `json:"lifetime"`
}

func HandleGetUserTrophies(c *gin.Context) {
	userID := c.Param("id")
	theirs, err := publicTrophies(context.GetCtx(c).DB, c.Request.Context(), userID)
	if err != nil {
		log.Printf("Trophies: error fetching trophies for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, Error("Failed to load trophies"))
		return
	}
	c.JSON(http.StatusOK, theirs)
}

// publicTrophies scores someone's whole history: their level, streak and totals
func publicTrophies(repo *sql.DB, ctx gocontext.Context, userID string) (PublicTrophies, error) {
	lifetime, err := queries.GetActivityCounts(repo, ctx, []string{userID}, queries.BeginningOfTime, queries.EndOfTime)
	if err != nil {
		return PublicTrophies{}, err
	}
	streak, err := queries.CalculateSubmissionActiveStreak(repo, ctx, userID)
	if err != nil {
		return PublicTrophies{}, err
	}
	theirs := lifetime[userID]
	return PublicTrophies{
		Level:         levelForXP(xpFor(theirs)),
		CurrentStreak: streak,
		Lifetime:      theirs,
	}, nil
}

func xpFor(a queries.ActivityCounts) int { return xp.For(a) }

// xpForKind is what one of GetXPEventsSince's events is worth, matching xpFor
func xpForKind(kind string) int {
	if i, ok := queries.JudgeScoreIndex(kind); ok {
		return judgeBonusXP(i)
	}
	if amount, ok := queries.AchievementXP(kind); ok {
		return amount
	}
	if i, ok := queries.QuestIndex(kind); ok {
		return xp.QuestBonus[queries.WeeklyQuests[i].ID]
	}
	return xpPerKind[kind]
}

// xpPerKind is what each of GetXPEventsSince's fixed kinds is worth, matching xpFor
var xpPerKind = map[string]int{
	"drawings":          xpPerDrawing,
	"commentsWritten":   xpPerCommentWritten,
	"reactionsGiven":    xpPerReactionGiven,
	"reactionsReceived": xpPerReactionReceived,
}

func levelForXP(amount int) Level { return xp.LevelFor(amount) }

// weekBounds returns midnight on the Monday that starts now's week, and on the Monday
// after, in now's time zone.
func weekBounds(now time.Time) (time.Time, time.Time) {
	daysSinceMonday := (int(now.Weekday()) + 6) % 7
	monday := time.Date(now.Year(), now.Month(), now.Day()-daysSinceMonday, 0, 0, 0, 0, now.Location())
	return monday, monday.AddDate(0, 0, 7)
}

func weekOf(monday, nextMonday time.Time) Week {
	return Week{
		Start:    utils.GetFormattedDate(monday),
		End:      utils.GetFormattedDate(nextMonday.AddDate(0, 0, -1)),
		ResetsAt: nextMonday,
	}
}

// newQuest is one of queries.WeeklyQuests, with its goal and bonus filled in
func newQuest(id, title, description string, progress int) Quest {
	i, _ := queries.QuestIndex(id)
	return Quest{ID: id, Title: title, Description: description, Progress: progress, Goal: queries.WeeklyQuests[i].Goal, XP: xp.QuestBonus[id]}
}

func weeklyQuests(a queries.ActivityCounts) []Quest {
	return []Quest{
		newQuest("draw-5", "Five-a-week", "Draw on 5 days this week", a.Drawings),
		newQuest("react-3", "Hype squad", "React to 3 friends' drawings", a.DrawingsReacted),
		newQuest("comment-3", "Chatterbox", "Leave 3 comments on friends' drawings", a.CommentsWritten),
		newQuest("get-comment", "Conversation starter", "Get a comment on one of your drawings", a.CommentsReceived),
	}
}

// markOutOfReach flags the quests the days left this week can't finish (see outOfReach)
func markOutOfReach(repo *sql.DB, ctx gocontext.Context, userID string, now time.Time, quests []Quest) error {
	drewToday, err := queries.CheckUserSubmittedToday(repo, ctx, userID)
	if err != nil {
		return err
	}
	outOfReach(quests, now, drewToday)
	return nil
}

// outOfReach flags the draw-5 quest (or its event version) when the days left this
// week can't make up the goal. One drawing a day counts, so someone who's drawn today
// has only the days after it left.
func outOfReach(quests []Quest, now time.Time, drewToday bool) {
	_, nextMonday := weekBounds(now)
	// Today through Sunday, counted on UTC calendar dates so a DST change can't skew it
	date := func(t time.Time) time.Time { return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC) }
	daysLeft := int(date(nextMonday).Sub(date(now)).Hours() / 24)
	if drewToday {
		daysLeft--
	}
	for i, q := range quests {
		if strings.TrimPrefix(q.ID, "event-") == "draw-5" && q.Progress < q.Goal {
			quests[i].OutOfReach = q.Progress+daysLeft < q.Goal
		}
	}
}

func leaderboard(users []models.User, counts map[string]queries.ActivityCounts) []LeaderboardEntry {
	entries := make([]LeaderboardEntry, 0, len(users))
	for _, u := range users {
		a := counts[u.ID]
		entries = append(entries, LeaderboardEntry{User: u, XP: xpFor(a), Drawings: a.Drawings})
	}
	slices.SortFunc(entries, func(a, b LeaderboardEntry) int {
		return cmp.Or(b.XP-a.XP, cmp.Compare(a.User.Username, b.User.Username))
	})
	return entries
}

// maxLevelsPerRequest caps how many users one levels lookup can score
const maxLevelsPerRequest = 100

// HandleGetUserLevels returns each asked-for user's level, so avatars anywhere
// can show it: GET /user/levels?ids=a,b,c → {"levels": {"a": 3, ...}}
func HandleGetUserLevels(c *gin.Context) {
	ids := make([]string, 0)
	seen := map[string]bool{}
	for _, id := range strings.Split(c.Query("ids"), ",") {
		if id = strings.TrimSpace(id); id != "" && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	if len(ids) > maxLevelsPerRequest {
		c.JSON(http.StatusBadRequest, Error("Too many users"))
		return
	}

	lifetime, err := queries.GetActivityCounts(context.GetCtx(c).DB, c.Request.Context(), ids, queries.BeginningOfTime, queries.EndOfTime)
	if err != nil {
		log.Printf("Levels: error fetching activity for %d users: %v", len(ids), err)
		c.JSON(http.StatusInternalServerError, Error("Failed to load levels"))
		return
	}

	levels := make(map[string]int, len(ids))
	for _, id := range ids {
		levels[id] = levelForXP(xpFor(lifetime[id])).Level
	}
	c.JSON(http.StatusOK, gin.H{"levels": levels})
}
