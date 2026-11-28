package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/utils"
	"errors"
	"fmt"
	"log"
	"time"
)

// FreeRedoDaysAt are the days everyone gets a redo for at now: the live event's countdown
// days (the Doodlemas tree's), so anyone can go back and hang the ones they missed. None
// between events.
func FreeRedoDaysAt(repo *sql.DB, ctx context.Context, now time.Time) FreeRedoDays {
	event, err := GetActiveEvent(repo, ctx, now)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			log.Printf("FreeRedoDaysAt: %v", err)
		}
		return FreeRedoDays{}
	}
	days, ok := events.CountdownDayRange(event)
	if !ok {
		return FreeRedoDays{}
	}
	return FreeRedoDays{First: days.First, Last: days.Last}
}

// LockedDays are the days whose prompts viewerID can still draw, so others' drawings of them
// stay out of sight until they have: today's, yesterday's while it can be finished late, and
// any missed day they can redo.
func LockedDays(repo *sql.DB, ctx context.Context, viewerID string, now time.Time) (map[string]bool, error) {
	today := utils.GetFormattedDate(now)
	locked := map[string]bool{}

	drewToday, err := CheckUserSubmittedOn(repo, ctx, viewerID, today)
	if err != nil {
		return nil, err
	}
	if !drewToday {
		locked[today] = true
	}
	lateDay, err := LateDay(repo, ctx, viewerID, now)
	if err != nil {
		return nil, err
	}
	if lateDay != "" {
		locked[lateDay] = true
	}
	redoable, err := RedoableDays(repo, ctx, viewerID, today, lateDay, FreeRedoDaysAt(repo, ctx, now))
	if err != nil {
		return nil, err
	}
	for _, day := range redoable {
		locked[day] = true
	}
	return locked, nil
}

// HideLockedDrawings withholds anyone else's drawing of one of the viewer's LockedDays: its
// image and the AI judge's verdict are blanked and it's marked Locked. All of them stay hidden
// if we couldn't tell which days are locked.
func HideLockedDrawings(repo *sql.DB, ctx context.Context, viewerID string, submissions []*models.UserPromptSubmission) error {
	var others []*models.UserPromptSubmission
	for _, submission := range submissions {
		if submission.User.ID != viewerID {
			others = append(others, submission)
		}
	}
	if len(others) == 0 {
		return nil
	}

	locked, err := LockedDays(repo, ctx, viewerID, time.Now())
	for _, submission := range others {
		// Some days come back with a time after the date
		if err != nil || locked[dayOf(submission.Day)] {
			lock(submission)
		}
	}
	return err
}

func lock(submission *models.UserPromptSubmission) {
	submission.Locked = true
	submission.ImageUrl = ""
	submission.AIReview = nil
	submission.AIReplies = nil
	submission.AIReplyPending = false
}

func dayOf(day string) string {
	if len(day) > len(utils.DateFormat) {
		return day[:len(utils.DateFormat)]
	}
	return day
}

// ErrDrawingLocked means the viewer hasn't drawn that day yet and can't touch others' drawings
// of it (see LockedDays).
var ErrDrawingLocked = errors.New("draw that day first")

// CheckSubmissionUnlocked returns ErrDrawingLocked when submissionID is someone else's drawing
// of one of viewerID's LockedDays.
func CheckSubmissionUnlocked(repo *sql.DB, ctx context.Context, viewerID, submissionID string) error {
	var ownerID, day string
	err := repo.QueryRowContext(ctx,
		`SELECT user_id, day FROM user_submissions WHERE id = ?`, submissionID).Scan(&ownerID, &day)
	if errors.Is(err, sql.ErrNoRows) || ownerID == viewerID {
		// No such drawing is for the caller to report
		return nil
	}
	if err != nil {
		return fmt.Errorf("error loading submission %s: %w", submissionID, err)
	}
	locked, err := LockedDays(repo, ctx, viewerID, time.Now())
	if err != nil {
		return err
	}
	if locked[dayOf(day)] {
		return ErrDrawingLocked
	}
	return nil
}
