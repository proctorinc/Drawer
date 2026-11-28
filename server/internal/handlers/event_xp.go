package handlers

import (
	gocontext "context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"time"
)

// Event XP isn't a new kind of XP: it's the share of the everyday XP earned while an event
// runs that only the event made possible (its doodles, reactions and stickers), so
// changing the everyday rules re-scores events too. Other XP earned meanwhile doesn't count.

// EventXPLine is one event-only way to earn XP and what it's earned so far.
type EventXPLine struct {
	Action string `json:"action"`
	Count  int    `json:"count"`
	XPEach int    `json:"xpEach"`
	XP     int    `json:"xp"`
}

type EventXP struct {
	// Total is the sum of Lines
	Total int `json:"total"`
	// Lines are the event-only ways to earn XP
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
	drawQuest, reactQuest, commentQuest, chatQuest    questCopy
}

var genericEventCopy = eventCopy{
	drawing:          "Doodle during the event",
	reactionGiven:    "Send an event reaction",
	reactionReceived: "Get an event reaction",
	sticker:          "Earn an event sticker",
	drawQuest:        questCopy{"Event regular", "Draw on 5 days this week"},
	reactQuest:       questCopy{"Join in", "Send event reactions to 3 friends' drawings"},
	commentQuest:     questCopy{"Chatterbox", "Leave 3 comments on friends' drawings"},
	chatQuest:        questCopy{"Conversation starter", "Get a comment on one of your doodles"},
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
		chatQuest:        questCopy{"Season's greetings", "Get a comment on one of your doodles"},
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
		// Stickers are each worth their own XP, so only an even split gets an "each"
		stickers := EventXPLine{Action: words.sticker, Count: e.Stickers, XP: e.StickerXP}
		if e.Stickers > 0 && e.StickerXP%e.Stickers == 0 {
			stickers.XPEach = e.StickerXP / e.Stickers
		}
		lines = append(lines, stickers)
	}
	total := 0
	for _, l := range lines {
		total += l.XP
	}
	return EventXP{Total: total, Lines: lines}
}

// eventQuests are weeklyQuests in the event's words, with the reaction quest asking for
// the event's own reactions when it has some.
func eventQuests(event models.Event, a queries.ActivityCounts, e queries.EventActivityCounts) []Quest {
	words := copyForTheme(event.Theme)
	react := newQuest("react-3", words.reactQuest.title, words.reactQuest.description, e.DrawingsReacted)
	if len(event.Reactions) == 0 {
		react = newQuest("react-3", words.reactQuest.title, "React to 3 friends' drawings", a.DrawingsReacted)
	}
	quests := []Quest{
		newQuest("draw-5", words.drawQuest.title, words.drawQuest.description, a.Drawings),
		react,
		newQuest("comment-3", words.commentQuest.title, words.commentQuest.description, a.CommentsWritten),
		newQuest("get-comment", words.chatQuest.title, words.chatQuest.description, a.CommentsReceived),
	}
	for i := range quests {
		quests[i].ID = "event-" + quests[i].ID
	}
	return quests
}
