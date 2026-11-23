package queries

import (
	"context"
	"database/sql"
	"fmt"
)

// Counts behind the extra Doodlemas achievements (migrations/1795132700_doodlemas_extras.up.sql).
// The event ones count inside the achievement's event, given as its first and last UTC day.

// CountEventReactionsGiven is how many of the event's own reactions the user gave friends'
// doodles and comments during [firstDay, lastDay].
func CountEventReactionsGiven(repo *sql.DB, ctx context.Context, userID, eventID, firstDay, lastDay string) (int, error) {
	var n int
	err := repo.QueryRowContext(ctx, `
		WITH ro AS (`+reactionOwners()+`)
		SELECT COUNT(*) FROM ro
		WHERE reactor = ? AND owner != reactor AND for_reactor
			AND date(created_at) BETWEEN ? AND ?
			AND reaction_id IN (SELECT reaction_id FROM event_reactions WHERE event_id = ?)`,
		userID, firstDay, lastDay, eventID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("counting event reactions given: %w", err)
	}
	return n, nil
}

// CountCommentsWrittenBetween is how many comments the user left on friends' doodles during
// [firstDay, lastDay].
func CountCommentsWrittenBetween(repo *sql.DB, ctx context.Context, userID, firstDay, lastDay string) (int, error) {
	var n int
	err := repo.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM comments c
		JOIN user_submissions s ON s.id = c.submission_id
		WHERE c.user_id = ? AND s.user_id != c.user_id
			AND date(c.created_at) BETWEEN ? AND ?
			AND `+countedAt("c.user_id", "c.created_at"),
		userID, firstDay, lastDay).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("counting comments written: %w", err)
	}
	return n, nil
}

// CountEventReactionsReceived is how many of the event's own reactions friends left on the
// user's doodles and comments during [firstDay, lastDay].
func CountEventReactionsReceived(repo *sql.DB, ctx context.Context, userID, eventID, firstDay, lastDay string) (int, error) {
	var n int
	err := repo.QueryRowContext(ctx, `
		WITH ro AS (`+reactionOwners()+`)
		SELECT COUNT(*) FROM ro
		WHERE owner = ? AND owner != reactor AND for_owner
			AND date(created_at) BETWEEN ? AND ?
			AND reaction_id IN (SELECT reaction_id FROM event_reactions WHERE event_id = ?)`,
		userID, firstDay, lastDay, eventID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("counting event reactions received: %w", err)
	}
	return n, nil
}

// CountFriendsCheered is how many different people the user sent the event's own reactions
// to during [firstDay, lastDay].
func CountFriendsCheered(repo *sql.DB, ctx context.Context, userID, eventID, firstDay, lastDay string) (int, error) {
	var n int
	err := repo.QueryRowContext(ctx, `
		WITH ro AS (`+reactionOwners()+`)
		SELECT COUNT(DISTINCT owner) FROM ro
		WHERE reactor = ? AND owner != reactor AND for_reactor
			AND date(created_at) BETWEEN ? AND ?
			AND reaction_id IN (SELECT reaction_id FROM event_reactions WHERE event_id = ?)`,
		userID, firstDay, lastDay, eventID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("counting friends cheered: %w", err)
	}
	return n, nil
}

// GrinchSundays is how a player's days with a judge that scores backwards (the Grinch) went.
// A day only counts once its answer is locked in, by drawing that day's doodle. Following
// through and going against him are by his score for that doodle: followScore and up means
// they drew it badly for him, defyScore and down that they drew it well.
type GrinchSundays struct {
	Joined  int // joined his plot
	Refused int // turned him down
	Loyal   int // joined, then drew badly for him
	Double  int // joined, then drew well anyway
	TrueWho int // refused, then drew well
	AllTalk int // refused, then drew badly anyway
}

// GetGrinchSundays tallies a player's locked-in answers to the Grinch (see GrinchSundays).
func GetGrinchSundays(repo *sql.DB, ctx context.Context, userID string, followScore, defyScore float64) (GrinchSundays, error) {
	var g GrinchSundays
	err := repo.QueryRowContext(ctx, `
		WITH locked AS (
			SELECT jp.joined, (
				SELECT r.score FROM ai_reviews r
				JOIN ai_personalities p ON p.id = r.personality_id AND p.scores_backwards = 1
				WHERE r.submission_id = s.id AND r.status = 'done'
			) AS score
			FROM judge_pledges jp
			JOIN user_submissions s ON s.user_id = jp.user_id AND s.day = jp.day
			WHERE jp.user_id = ?
		)
		SELECT
			COALESCE(SUM(joined = 1), 0),
			COALESCE(SUM(joined = 0), 0),
			COALESCE(SUM(joined = 1 AND score >= ?), 0),
			COALESCE(SUM(joined = 1 AND score <= ?), 0),
			COALESCE(SUM(joined = 0 AND score <= ?), 0),
			COALESCE(SUM(joined = 0 AND score >= ?), 0)
		FROM locked`,
		userID, followScore, defyScore, defyScore, followScore,
	).Scan(&g.Joined, &g.Refused, &g.Loyal, &g.Double, &g.TrueWho, &g.AllTalk)
	if err != nil {
		return GrinchSundays{}, fmt.Errorf("tallying Grinch Sundays: %w", err)
	}
	return g, nil
}

// GrinchDay is one day judged by a judge that scores backwards (the Grinch), and whose side
// a player took that day: Joined is nil if they never answered.
type GrinchDay struct {
	Day    string `json:"day"`
	Joined *bool  `json:"joined"`
}

// GetGrinchDays lists the days in [firstDay, lastDay] the Grinch judges, oldest first, with
// the player's answer on each.
func GetGrinchDays(repo *sql.DB, ctx context.Context, userID, firstDay, lastDay string) ([]GrinchDay, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT dp.day, jp.joined FROM daily_prompts dp
		JOIN ai_personalities p ON p.id = dp.judge_id AND p.scores_backwards = 1
		LEFT JOIN judge_pledges jp ON jp.user_id = ? AND jp.day = dp.day
		WHERE dp.day BETWEEN ? AND ?
		ORDER BY dp.day`, userID, firstDay, lastDay)
	if err != nil {
		return nil, fmt.Errorf("listing Grinch days: %w", err)
	}
	defer rows.Close()
	days := []GrinchDay{}
	for rows.Next() {
		var d GrinchDay
		var joined sql.NullBool
		if err := rows.Scan(&d.Day, &joined); err != nil {
			return nil, fmt.Errorf("listing Grinch days: %w", err)
		}
		if joined.Valid {
			d.Joined = &joined.Bool
		}
		days = append(days, d)
	}
	return days, rows.Err()
}

// GetDayPledges is who among the player and their friends joined the Grinch on day, and who
// turned him down. Both are empty on a day nobody was asked.
func GetDayPledges(repo *sql.DB, ctx context.Context, userID, day string) (joined, refused []string, err error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT user_id, joined FROM judge_pledges
		WHERE day = ? AND (user_id = ?
			OR user_id IN (SELECT user2 FROM friendships WHERE user1 = ? AND state = 'accepted')
			OR user_id IN (SELECT user1 FROM friendships WHERE user2 = ? AND state = 'accepted'))`,
		day, userID, userID, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("loading the day's pledges: %w", err)
	}
	defer rows.Close()
	joined, refused = []string{}, []string{}
	for rows.Next() {
		var id string
		var j bool
		if err := rows.Scan(&id, &j); err != nil {
			return nil, nil, fmt.Errorf("loading the day's pledges: %w", err)
		}
		if j {
			joined = append(joined, id)
		} else {
			refused = append(refused, id)
		}
	}
	return joined, refused, rows.Err()
}
