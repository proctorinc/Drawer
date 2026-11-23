package handlers

import (
	"cmp"
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/reactions"
	"errors"
	"log"
	"net/http"
	"slices"
	"time"

	"github.com/gin-gonic/gin"
)

type ActiveEventResponse struct {
	Event *events.ActiveEvent `json:"event"`
}

func HandleGetActiveEvent(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	now := events.Now(appCtx.Config)

	event, err := queries.GetActiveEvent(appCtx.DB, c.Request.Context(), now)
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusOK, ActiveEventResponse{Event: nil})
		return
	}
	if err != nil {
		log.Printf("Error fetching active event at %s: %v", now, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve active event"))
		return
	}

	activeEvent, err := eventWithProgress(c, event, now, middleware.GetUserID(c))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve active event"))
		return
	}
	c.JSON(http.StatusOK, ActiveEventResponse{Event: &activeEvent})
}

// eventWithProgress builds the event JSON with the signed-in user's doodled days.
func eventWithProgress(c *gin.Context, event models.Event, now time.Time, userID string) (events.ActiveEvent, error) {
	appCtx := requestContext.GetCtx(c)
	days := events.Days(event)

	doodledDays, err := queries.GetUserSubmissionDays(appCtx.DB, c.Request.Context(), userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error fetching event %s progress for user %s: %v", event.Slug, userID, err)
		return events.ActiveEvent{}, err
	}

	activeEvent := events.NewActiveEvent(event, now)
	activeEvent.Progress = events.NewProgress(doodledDays)
	return activeEvent, nil
}

// eventFromSlug loads the :slug event, responding 404/500 and returning false if it can't.
func eventFromSlug(c *gin.Context) (models.Event, bool) {
	appCtx := requestContext.GetCtx(c)
	slug := c.Param("slug")

	event, err := queries.GetEventBySlug(appCtx.DB, c.Request.Context(), slug)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Event not found"))
		return models.Event{}, false
	}
	if err != nil {
		log.Printf("Error fetching event %s: %v", slug, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve event"))
		return models.Event{}, false
	}
	// An event stays a secret until it starts: nothing about it is served before then
	if events.Now(appCtx.Config).Before(event.StartsAt) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Event not found"))
		return models.Event{}, false
	}
	return event, true
}

// upcomingEventWindow is how far ahead an event is teased before it starts
const upcomingEventWindow = 14 * 24 * time.Hour

// UpcomingEvent is all that's revealed of an event before it starts: enough for a teaser.
type UpcomingEvent struct {
	Slug     string    `json:"slug"`
	Name     string    `json:"name"`
	Theme    string    `json:"theme"`
	StartsAt time.Time `json:"startsAt"`
	EndsAt   time.Time `json:"endsAt"` // Exclusive
	// CountdownDays is the length of the "day N of X" countdown, or nil if the event has none.
	CountdownDays *int `json:"countdownDays"`
}

type UpcomingEventResponse struct {
	Event *UpcomingEvent `json:"event"`
}

// HandleGetUpcomingEvent returns the next event starting within upcomingEventWindow, if any.
// Only its name, theme and dates are given (enough to mark a calendar); the rest waits until it starts.
func HandleGetUpcomingEvent(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	now := events.Now(appCtx.Config)

	event, err := queries.GetNextEvent(appCtx.DB, c.Request.Context(), now)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && event.StartsAt.Sub(now) > upcomingEventWindow) {
		c.JSON(http.StatusOK, UpcomingEventResponse{Event: nil})
		return
	}
	if err != nil {
		log.Printf("Error fetching upcoming event at %s: %v", now, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve upcoming event"))
		return
	}

	c.JSON(http.StatusOK, UpcomingEventResponse{Event: &UpcomingEvent{
		Slug:          event.Slug,
		Name:          event.Name,
		Theme:         event.Theme,
		StartsAt:      event.StartsAt.UTC(),
		EndsAt:        event.EndsAt.UTC(),
		CountdownDays: event.CountdownDays,
	}})
}

type EventLeaderboardResponse struct {
	Entries []queries.EventLeaderboardEntry `json:"entries"`
}

// HandleGetEventLeaderboard ranks the signed-in user and their friends by doodles during
// the event, then by XP earned during it.
func HandleGetEventLeaderboard(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	userID := middleware.GetUserID(c)

	event, ok := eventFromSlug(c)
	if !ok {
		return
	}

	days := events.Days(event)
	entries, err := queries.GetEventLeaderboard(appCtx.DB, c.Request.Context(), userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error fetching event %s leaderboard for user %s: %v", event.Slug, userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve leaderboard"))
		return
	}

	userIDs := make([]string, len(entries))
	for i, entry := range entries {
		userIDs[i] = entry.User.ID
	}
	// Event days are UTC days, as are user_submissions.day
	during, err := queries.GetActivityCounts(appCtx.DB, c.Request.Context(), userIDs, event.StartsAt.UTC(), event.EndsAt.UTC())
	if err != nil {
		log.Printf("Error fetching event %s leaderboard XP for user %s: %v", event.Slug, userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve leaderboard"))
		return
	}
	for i := range entries {
		entries[i].XP = xpFor(during[entries[i].User.ID])
	}
	rankLeaderboard(entries)

	c.JSON(http.StatusOK, EventLeaderboardResponse{Entries: entries})
}

// rankLeaderboard puts the most XP earned during the event first, with doodles drawn
// breaking ties
func rankLeaderboard(entries []queries.EventLeaderboardEntry) {
	slices.SortStableFunc(entries, func(a, b queries.EventLeaderboardEntry) int {
		return cmp.Or(b.XP-a.XP, b.Doodles-a.Doodles)
	})
}

type EventRecapStats struct {
	Doodles           int `json:"doodles"`
	ReactionsReceived int `json:"reactionsReceived"`
	LongestStreak     int `json:"longestStreak"`
}

type EventRecapResponse struct {
	// User is whose recap this is: you, or whoever ?user= names
	User        models.User                   `json:"user"`
	Event       events.ActiveEvent            `json:"event"`
	Submissions []models.UserPromptSubmission `json:"submissions"`
	Stats       EventRecapStats               `json:"stats"`
	XP          EventXP                       `json:"xp"`
	// Quests is this week's quests, only on your own recap while the event is live
	Quests *EventQuests `json:"quests"`
	// GrinchDays is the days the Grinch judges during the event, with whose side they took
	GrinchDays []queries.GrinchDay `json:"grinchDays"`
}

// HandleGetEventRecap returns a user's doodles and stats for an event: the
// signed-in user's, or anyone's named by ?user=<id> (as on their profile).
func HandleGetEventRecap(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	requesterID := middleware.GetUserID(c)
	userID := c.DefaultQuery("user", requesterID)

	event, ok := eventFromSlug(c)
	if !ok {
		return
	}

	user, err := queries.GetUserByID(appCtx.DB, ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("User not found"))
		return
	} else if err != nil {
		log.Printf("Error loading user %s for event %s recap: %v", userID, event.Slug, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve recap"))
		return
	}

	now := events.Now(appCtx.Config)
	recapEvent, err := eventWithProgress(c, event, now, userID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve recap"))
		return
	}

	days := events.Days(event)
	submissions, err := queries.GetUserSubmissionsInDays(appCtx.DB, ctx, appCtx.Config, userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error fetching event %s submissions for user %s: %v", event.Slug, userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve recap"))
		return
	}

	reactionsReceived, err := queries.CountReactionsReceived(appCtx.DB, ctx, userID, days.First, days.Last)
	if err != nil {
		log.Printf("Error counting event %s reactions for user %s: %v", event.Slug, userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve recap"))
		return
	}

	fail := func(what string, err error) {
		log.Printf("Error fetching event %s %s for user %s: %v", event.Slug, what, userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to retrieve recap"))
	}

	// Event days are UTC days, as are user_submissions.day
	during, duringEvent, err := activityIn(appCtx.DB, ctx, userID, event, event.StartsAt.UTC(), event.EndsAt.UTC())
	if err != nil {
		fail("XP", err)
		return
	}

	// Quests follow the active event, as the trophy page does when it hides its own
	active, err := queries.GetActiveEvent(appCtx.DB, ctx, now)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		fail("active event", err)
		return
	}
	var quests *EventQuests
	if err == nil && active.ID == event.ID && userID == requesterID {
		// Same clock as the trophy page's weeks, which these quests stand in for
		week, nextWeek := weekBounds(time.Now())
		thisWeek, thisWeekEvent, err := activityIn(appCtx.DB, ctx, userID, event, week, nextWeek)
		if err != nil {
			fail("quests", err)
			return
		}
		quests = &EventQuests{Week: weekOf(week, nextWeek), Quests: eventQuests(event, thisWeek, thisWeekEvent)}
		if err := markOutOfReach(appCtx.DB, ctx, userID, time.Now(), quests.Quests); err != nil {
			fail("quests", err)
			return
		}
	}

	c.JSON(http.StatusOK, EventRecapResponse{
		User:        *user,
		Event:       recapEvent,
		Submissions: submissions,
		Stats: EventRecapStats{
			Doodles:           recapEvent.Progress.Count,
			ReactionsReceived: reactionsReceived,
			LongestStreak:     events.LongestStreak(recapEvent.Progress.DoodledDays),
		},
		XP:         eventXP(event, during, duringEvent),
		Quests:     quests,
		GrinchDays: grinchDaysFor(c, userID, days),
	})
}

// isReactionAllowed accepts everyday catalog reactions, plus event-only ones (see
// reactions.json) while an event that lists them is active.
// Reactions given during an event stay stored (and displayed) after it ends.
func isReactionAllowed(c *gin.Context, reactionID string) (bool, error) {
	if reactions.IsValid(reactionID) {
		return true, nil
	}
	if !reactions.IsEventOnly(reactionID) {
		return false, nil
	}
	appCtx := requestContext.GetCtx(c)
	return queries.IsEventReactionAllowed(appCtx.DB, c.Request.Context(), reactionID, events.Now(appCtx.Config))
}
