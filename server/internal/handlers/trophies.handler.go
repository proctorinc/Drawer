package handlers

import (
	"cmp"
	"database/sql"
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"errors"
	"log"
	"net/http"
	"slices"
	"time"

	"github.com/gin-gonic/gin"
)

// XP is computed from existing activity rather than stored, so changing these
// values re-scores everyone's history.
const (
	xpPerDrawing          = 10
	xpPerCommentWritten   = 3
	xpPerReactionGiven    = 2
	xpPerReactionReceived = 1
	xpPerAchievement      = 25
	// Going from level n to n+1 costs n * xpPerLevelStep
	xpPerLevelStep = 50
)

type XPRule struct {
	Action string `json:"action"`
	XP     int    `json:"xp"`
}

var xpRules = []XPRule{
	{"Draw the daily prompt", xpPerDrawing},
	{"Comment on a friend's drawing", xpPerCommentWritten},
	{"React to a friend", xpPerReactionGiven},
	{"Get a reaction", xpPerReactionReceived},
	{"Earn an achievement", xpPerAchievement},
}

type Level struct {
	Level int `json:"level"`
	XP    int `json:"xp"`
	// XP at which the current level started and the next one begins
	LevelStartXP int `json:"levelStartXp"`
	NextLevelXP  int `json:"nextLevelXp"`
}

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

	lifetime, err := queries.GetActivityCounts(repo, ctx, []string{requester.ID}, queries.BeginningOfTime, queries.EndOfTime)
	if err != nil {
		fail("lifetime activity", err)
		return
	}
	streak, err := queries.CalculateSubmissionActiveStreak(repo, ctx, requester.ID)
	if err != nil {
		fail("streak", err)
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
	weekly, err := queries.GetActivityCounts(repo, ctx, boardIDs, week, nextWeek)
	if err != nil {
		fail("weekly activity", err)
		return
	}
	users, err := queries.GetUsersByIDs(repo, ctx, boardIDs)
	if err != nil {
		fail("leaderboard users", err)
		return
	}

	quests, questsEvent := weeklyQuests(weekly[requester.ID]), (*EventLink)(nil)
	event, err := queries.GetActiveEvent(repo, ctx, events.Now(context.GetCtx(c).Config))
	if err == nil {
		quests, questsEvent = []Quest{}, &EventLink{Slug: event.Slug, Name: event.Name, Theme: event.Theme}
	} else if !errors.Is(err, sql.ErrNoRows) {
		fail("active event", err)
		return
	}

	mine := lifetime[requester.ID]
	c.JSON(http.StatusOK, TrophiesResponse{
		Level:         levelForXP(xpFor(mine)),
		CurrentStreak: streak,
		Lifetime:      mine,
		Week:          weekOf(week, nextWeek),
		Quests:        quests,
		QuestsEvent:   questsEvent,
		Leaderboard:   leaderboard(users, weekly),
		XPRules:       xpRules,
	})
}

func xpFor(a queries.ActivityCounts) int {
	return a.Drawings*xpPerDrawing +
		a.CommentsWritten*xpPerCommentWritten +
		a.ReactionsGiven*xpPerReactionGiven +
		a.ReactionsReceived*xpPerReactionReceived +
		a.Achievements*xpPerAchievement
}

// xpPerKind is what each of GetXPEventsSince's kinds is worth, matching xpFor
var xpPerKind = map[string]int{
	"drawings":          xpPerDrawing,
	"commentsWritten":   xpPerCommentWritten,
	"reactionsGiven":    xpPerReactionGiven,
	"reactionsReceived": xpPerReactionReceived,
	"achievements":      xpPerAchievement,
}

func levelForXP(xp int) Level {
	level, start := 1, 0
	for {
		next := start + level*xpPerLevelStep
		if xp < next {
			return Level{Level: level, XP: xp, LevelStartXP: start, NextLevelXP: next}
		}
		level, start = level+1, next
	}
}

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

func weeklyQuests(a queries.ActivityCounts) []Quest {
	return []Quest{
		{"draw-5", "Five-a-week", "Draw on 5 days this week", a.Drawings, 5},
		{"react-3", "Hype squad", "React to 3 friends' drawings", a.DrawingsReacted, 3},
		{"comment-3", "Chatterbox", "Leave 3 comments on friends' drawings", a.CommentsWritten, 3},
		{"cry-laugh", "Class clown", "Make a friend cry-laugh", a.CryLaughsReceived, 1},
	}
}

func leaderboard(users []models.User, weekly map[string]queries.ActivityCounts) []LeaderboardEntry {
	entries := make([]LeaderboardEntry, 0, len(users))
	for _, u := range users {
		a := weekly[u.ID]
		entries = append(entries, LeaderboardEntry{User: u, XP: xpFor(a), Drawings: a.Drawings})
	}
	slices.SortFunc(entries, func(a, b LeaderboardEntry) int {
		return cmp.Or(b.XP-a.XP, cmp.Compare(a.User.Username, b.User.Username))
	})
	return entries
}
