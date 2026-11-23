package stats

import (
	"drawer-service-backend/internal/ai"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/utils"
	"fmt"
	"slices"
	"time"
)

// The extra Doodlemas achievements (migrations/1795132700_doodlemas_extras.up.sql). The EVENT_
// ones count inside the achievement's event; the GRINCH_ ones count the player's locked-in
// answers to the Grinch (judge_pledges), and how they drew after.
var (
	// The event's own reactions given to friends
	EVENT_REACTION_TOTAL StatsField = "EVENT_REACTION_TOTAL"
	// Comments left on friends' doodles
	EVENT_COMMENT_TOTAL StatsField = "EVENT_COMMENT_TOTAL"
	// The event's own reactions friends left on your doodles and comments
	EVENT_REACTION_RECEIVED_TOTAL StatsField = "EVENT_REACTION_RECEIVED_TOTAL"
	// Different friends you sent the event's own reactions to
	EVENT_FRIENDS_CHEERED StatsField = "EVENT_FRIENDS_CHEERED"
	// The longest run of days in a row doodled
	EVENT_STREAK StatsField = "EVENT_STREAK"
	// Doodled on the event's first day (1) or not (0)
	EVENT_FIRST_DAY StatsField = "EVENT_FIRST_DAY"
	// Doodled on the day before the countdown's last (Christmas Eve) (1) or not (0)
	EVENT_CHRISTMAS_EVE StatsField = "EVENT_CHRISTMAS_EVE"
	// Days doodled after the countdown ended, while the event still runs
	EVENT_AFTER_CHRISTMAS_TOTAL StatsField = "EVENT_AFTER_CHRISTMAS_TOTAL"

	GRINCH_JOINED_TOTAL       StatsField = "GRINCH_JOINED_TOTAL"
	GRINCH_REFUSED_TOTAL      StatsField = "GRINCH_REFUSED_TOTAL"
	GRINCH_BOTH_SIDES         StatsField = "GRINCH_BOTH_SIDES"
	GRINCH_LOYAL_TOTAL        StatsField = "GRINCH_LOYAL_TOTAL"
	GRINCH_DOUBLE_AGENT_TOTAL StatsField = "GRINCH_DOUBLE_AGENT_TOTAL"
	GRINCH_TRUE_WHO_TOTAL     StatsField = "GRINCH_TRUE_WHO_TOTAL"
	GRINCH_ALL_TALK_TOTAL     StatsField = "GRINCH_ALL_TALK_TOTAL"
	// Grinch days answered either way, for seeing every one of them through
	GRINCH_DAYS_TOTAL StatsField = "GRINCH_DAYS_TOTAL"
)

// EVENT_DAY_FIELDS move when a doodle is drawn
var EVENT_DAY_FIELDS = []string{
	string(EVENT_STREAK), string(EVENT_FIRST_DAY), string(EVENT_CHRISTMAS_EVE), string(EVENT_AFTER_CHRISTMAS_TOTAL),
}

// GRINCH_PLEDGE_FIELDS lock in when the day's doodle is drawn, so a new doodle can move them
var GRINCH_PLEDGE_FIELDS = []string{
	string(GRINCH_JOINED_TOTAL), string(GRINCH_REFUSED_TOTAL), string(GRINCH_BOTH_SIDES),
	string(GRINCH_DAYS_TOTAL),
}

// GRINCH_SCORE_FIELDS turn on the Grinch's score, so they move when he reviews a doodle
var GRINCH_SCORE_FIELDS = []string{
	string(GRINCH_LOYAL_TOTAL), string(GRINCH_DOUBLE_AGENT_TOTAL),
	string(GRINCH_TRUE_WHO_TOTAL), string(GRINCH_ALL_TALK_TOTAL),
}

// doodlemasCount is the count behind one of the extra Doodlemas achievements; ok is false for
// any other field.
func (ss *StatsService) doodlemasCount(userId string, achievement models.Achievement) (count int, ok bool, err error) {
	field := StatsField(achievement.AchievementField)
	switch field {
	case EVENT_REACTION_TOTAL, EVENT_COMMENT_TOTAL, EVENT_REACTION_RECEIVED_TOTAL, EVENT_FRIENDS_CHEERED,
		EVENT_STREAK, EVENT_FIRST_DAY, EVENT_CHRISTMAS_EVE, EVENT_AFTER_CHRISTMAS_TOTAL:
		event, err := queries.GetAchievementEvent(ss.DB, ss.Ctx, achievement.ID)
		if err != nil {
			return 0, true, fmt.Errorf("finding the event for achievement %s: %w", achievement.ID, err)
		}
		days := events.Days(event)
		switch field {
		case EVENT_REACTION_TOTAL:
			count, err = queries.CountEventReactionsGiven(ss.DB, ss.Ctx, userId, event.ID, days.First, days.Last)
		case EVENT_COMMENT_TOTAL:
			count, err = queries.CountCommentsWrittenBetween(ss.DB, ss.Ctx, userId, days.First, days.Last)
		case EVENT_REACTION_RECEIVED_TOTAL:
			count, err = queries.CountEventReactionsReceived(ss.DB, ss.Ctx, userId, event.ID, days.First, days.Last)
		case EVENT_FRIENDS_CHEERED:
			count, err = queries.CountFriendsCheered(ss.DB, ss.Ctx, userId, event.ID, days.First, days.Last)
		default:
			var doodled []string
			doodled, err = queries.GetUserSubmissionDays(ss.DB, ss.Ctx, userId, days.First, days.Last)
			count = countDays(field, event, days, doodled)
		}
		return count, true, err

	case GRINCH_JOINED_TOTAL, GRINCH_REFUSED_TOTAL, GRINCH_BOTH_SIDES, GRINCH_LOYAL_TOTAL,
		GRINCH_DOUBLE_AGENT_TOTAL, GRINCH_TRUE_WHO_TOTAL, GRINCH_ALL_TALK_TOTAL, GRINCH_DAYS_TOTAL:
		if ss.grinch == nil {
			g, err := queries.GetGrinchSundays(ss.DB, ss.Ctx, userId, ai.AccompliceScore, ai.DefierScore)
			if err != nil {
				return 0, true, err
			}
			ss.grinch = &g
		}
		g := *ss.grinch
		switch field {
		case GRINCH_JOINED_TOTAL:
			count = g.Joined
		case GRINCH_REFUSED_TOTAL:
			count = g.Refused
		case GRINCH_BOTH_SIDES:
			count = min(g.Joined, g.Refused, 1)
		case GRINCH_LOYAL_TOTAL:
			count = g.Loyal
		case GRINCH_DOUBLE_AGENT_TOTAL:
			count = g.Double
		case GRINCH_TRUE_WHO_TOTAL:
			count = g.TrueWho
		case GRINCH_ALL_TALK_TOTAL:
			count = g.AllTalk
		case GRINCH_DAYS_TOTAL:
			count = g.Joined + g.Refused
		}
		return count, true, nil
	}
	return 0, false, nil
}

// countDays is what a day-based event field makes of the days doodled during the event
// (YYYY-MM-DD, ascending)
func countDays(field StatsField, event models.Event, days events.DayRange, doodled []string) int {
	countdown, hasCountdown := events.CountdownDayRange(event)
	has := func(day string) int {
		if slices.Contains(doodled, day) {
			return 1
		}
		return 0
	}
	switch field {
	case EVENT_STREAK:
		return events.LongestStreak(doodled)
	case EVENT_FIRST_DAY:
		return has(days.First)
	case EVENT_CHRISTMAS_EVE:
		if !hasCountdown {
			return 0
		}
		last, err := time.Parse(utils.DateFormat, countdown.Last)
		if err != nil {
			return 0
		}
		return has(utils.GetFormattedDate(last.AddDate(0, 0, -1)))
	case EVENT_AFTER_CHRISTMAS_TOTAL:
		if !hasCountdown {
			return 0
		}
		n := 0
		for _, day := range doodled {
			if day > countdown.Last {
				n++
			}
		}
		return n
	}
	return 0
}
