package handlers

import (
	gocontext "context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"time"
)

// Event XP isn't a new kind of XP: it's the everyday XP earned while an event runs, with
// the share that only the event made possible (its doodles, reactions and stickers)
// broken out, so changing the everyday rules re-scores events too.

// EventXPLine is one event-only way to earn XP and what it's earned so far.
type EventXPLine struct {
	Action string `json:"action"`
	Count  int    `json:"count"`
	XPEach int    `json:"xpEach"`
	XP     int    `json:"xp"`
}

type EventXP struct {
	// Total is all XP earned while the event ran, event-related or not
	Total int `json:"total"`
	// Lines are the event's own share of Total; the rest came from everyday activity
	Lines []EventXPLine `json:"lines"`
}

// EventQuests are the weekly quests while an event is live. They replace the everyday
// ones on the trophy page, so each week has one set of quests.
type EventQuests struct {
	Week   Week    `json:"week"`
	Quests []Quest `json:"quests"`
}

// EventLink names the event whose page the weekly quests moved to.
type EventLink struct {
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Theme string `json:"theme"`
}

type questCopy struct{ title, description string }

// eventCopy is how an event theme words its XP actions and weekly quests.
type eventCopy struct {
	drawing, reactionGiven, reactionReceived, sticker string
	drawQuest, reactQuest, commentQuest, laughQuest   questCopy
}

var genericEventCopy = eventCopy{
	drawing:          "Doodle during the event",
	reactionGiven:    "Send an event reaction",
	reactionReceived: "Get an event reaction",
	sticker:          "Earn an event sticker",
	drawQuest:        questCopy{"Event regular", "Draw on 5 days this week"},
	reactQuest:       questCopy{"Join in", "Send event reactions to 3 friends' drawings"},
	commentQuest:     questCopy{"Chatterbox", "Leave 3 comments on friends' drawings"},
	laughQuest:       questCopy{"Class clown", "Make a friend cry-laugh"},
}

var eventCopyByTheme = map[string]eventCopy{
	"christmas": {
		drawing:          "Hang a doodle on the tree",
		reactionGiven:    "Send a festive reaction",
		reactionReceived: "Get a festive reaction",
		sticker:          "Earn a christmas sticker",
		drawQuest:        questCopy{"Deck the tree", "Hang a doodle on 5 days this week"},
		reactQuest:       questCopy{"Spread some cheer", "Send festive reactions to 3 friends' drawings"},
		commentQuest:     questCopy{"Carol singer", "Leave 3 comments on friends' drawings"},
		laughQuest:       questCopy{"Ho ho ho", "Make a friend cry-laugh"},
	},
}

func copyForTheme(theme string) eventCopy {
	if c, ok := eventCopyByTheme[theme]; ok {
		return c
	}
	return genericEventCopy
}

// activityIn counts a user's everyday and event-only activity in [from, to).
func activityIn(repo *sql.DB, ctx gocontext.Context, userID string, event models.Event, from, to time.Time) (queries.ActivityCounts, queries.EventActivityCounts, error) {
	counts, err := queries.GetActivityCounts(repo, ctx, []string{userID}, from, to)
	if err != nil {
		return queries.ActivityCounts{}, queries.EventActivityCounts{}, err
	}
	eventCounts, err := queries.GetEventActivityCounts(repo, ctx, userID, event.ID, from, to)
	return counts[userID], eventCounts, err
}

func eventXP(event models.Event, a queries.ActivityCounts, e queries.EventActivityCounts) EventXP {
	words := copyForTheme(event.Theme)
	line := func(action string, count, xpEach int) EventXPLine {
		return EventXPLine{Action: action, Count: count, XPEach: xpEach, XP: count * xpEach}
	}

	// Every doodle drawn during an event is an event doodle
	lines := []EventXPLine{line(words.drawing, a.Drawings, xpPerDrawing)}
	if len(event.Reactions) > 0 {
		lines = append(lines,
			line(words.reactionGiven, e.ReactionsGiven, xpPerReactionGiven),
			line(words.reactionReceived, e.ReactionsReceived, xpPerReactionReceived))
	}
	if e.StickersOffered > 0 {
		lines = append(lines, line(words.sticker, e.Stickers, xpPerAchievement))
	}
	return EventXP{Total: xpFor(a), Lines: lines}
}

// eventQuests are weeklyQuests in the event's words, with the reaction quest asking for
// the event's own reactions when it has some.
func eventQuests(event models.Event, a queries.ActivityCounts, e queries.EventActivityCounts) []Quest {
	words := copyForTheme(event.Theme)
	react := Quest{"event-react-3", words.reactQuest.title, words.reactQuest.description, e.DrawingsReacted, 3}
	if len(event.Reactions) == 0 {
		react = Quest{"event-react-3", words.reactQuest.title, "React to 3 friends' drawings", a.DrawingsReacted, 3}
	}
	return []Quest{
		{"event-draw-5", words.drawQuest.title, words.drawQuest.description, a.Drawings, 5},
		react,
		{"event-comment-3", words.commentQuest.title, words.commentQuest.description, a.CommentsWritten, 3},
		{"event-cry-laugh", words.laughQuest.title, words.laughQuest.description, a.CryLaughsReceived, 1},
	}
}
