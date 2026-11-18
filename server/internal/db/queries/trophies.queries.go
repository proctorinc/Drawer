package queries

import (
	"cmp"
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"time"
)

// ActivityCounts is what a user did in a date range. Only social actions aimed at
// someone else count, so reacting to your own drawing earns nothing.
type ActivityCounts struct {
	Drawings          int `json:"drawings"`
	ReactionsGiven    int `json:"reactionsGiven"`
	DrawingsReacted   int `json:"drawingsReacted"` // distinct friends' drawings reacted to
	CommentsWritten   int `json:"commentsWritten"`
	ReactionsReceived int `json:"reactionsReceived"`
	CryLaughsReceived int `json:"cryLaughsReceived"`
	Achievements      int `json:"achievements"`
}

// Bounds wide enough to cover all of time, for lifetime totals.
var (
	BeginningOfTime = time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC)
	EndOfTime       = time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC)
)

// sqliteTimestamp is how CURRENT_TIMESTAMP writes created_at, always in UTC.
const sqliteTimestamp = "2006-01-02 15:04:05"

// reactionOwners resolves who owns the drawing or comment each reaction is on.
const reactionOwners = `
	SELECT r.user_id AS reactor, COALESCE(s.user_id, cs.user_id) AS owner, r.reaction_id,
		r.content_type, r.content_id, r.created_at
	FROM reactions r
	LEFT JOIN user_submissions s ON r.content_type = 'submission' AND s.id = r.content_id
	LEFT JOIN comments cs ON r.content_type = 'comment' AND cs.id = r.content_id
`

// GetActivityCounts counts each user's activity in [from, to). It runs one query
// however many users are asked for.
//
// Drawings are matched on their day, a date on the server's clock, so from and to
// should be midnights in the server's time zone. Everything else is matched on
// created_at, which is UTC, so the same instants are converted to UTC for those.
func GetActivityCounts(repo *sql.DB, ctx context.Context, userIDs []string, from, to time.Time) (map[string]ActivityCounts, error) {
	counts := make(map[string]ActivityCounts, len(userIDs))
	if len(userIDs) == 0 {
		return counts, nil
	}

	in := "(" + placeholders(len(userIDs)) + ")"
	query := `
		WITH ro AS (` + reactionOwners + `)
		SELECT user_id, 'drawings', COUNT(*) FROM user_submissions
		WHERE user_id IN ` + in + ` AND day >= ? AND day < ?
		GROUP BY user_id
		UNION ALL
		SELECT reactor, 'reactionsGiven', COUNT(*) FROM ro
		WHERE reactor IN ` + in + ` AND owner != reactor AND created_at >= ? AND created_at < ?
		GROUP BY reactor
		UNION ALL
		SELECT reactor, 'drawingsReacted', COUNT(DISTINCT content_id) FROM ro
		WHERE reactor IN ` + in + ` AND owner != reactor AND content_type = 'submission'
			AND created_at >= ? AND created_at < ?
		GROUP BY reactor
		UNION ALL
		SELECT c.user_id, 'commentsWritten', COUNT(*) FROM comments c
		JOIN user_submissions s ON s.id = c.submission_id
		WHERE c.user_id IN ` + in + ` AND s.user_id != c.user_id AND c.created_at >= ? AND c.created_at < ?
		GROUP BY c.user_id
		UNION ALL
		SELECT owner, 'reactionsReceived', COUNT(*) FROM ro
		WHERE owner IN ` + in + ` AND owner != reactor AND created_at >= ? AND created_at < ?
		GROUP BY owner
		UNION ALL
		SELECT owner, 'cryLaughsReceived', COUNT(*) FROM ro
		WHERE owner IN ` + in + ` AND owner != reactor AND reaction_id = 'cry-laugh'
			AND created_at >= ? AND created_at < ?
		GROUP BY owner
		UNION ALL
		SELECT user_id, 'achievements', COUNT(*) FROM user_achievements
		WHERE user_id IN ` + in + ` AND created_at >= ? AND created_at < ?
		GROUP BY user_id
	`

	const parts = 7
	args := make([]any, 0, parts*(len(userIDs)+2))
	for i := range parts {
		for _, id := range userIDs {
			args = append(args, id)
		}
		if i == 0 {
			args = append(args, utils.GetFormattedDate(from), utils.GetFormattedDate(to))
		} else {
			args = append(args, from.UTC().Format(sqliteTimestamp), to.UTC().Format(sqliteTimestamp))
		}
	}

	rows, err := repo.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var userID, kind string
		var n int
		if err := rows.Scan(&userID, &kind, &n); err != nil {
			return nil, err
		}
		c := counts[userID]
		switch kind {
		case "drawings":
			c.Drawings = n
		case "reactionsGiven":
			c.ReactionsGiven = n
		case "drawingsReacted":
			c.DrawingsReacted = n
		case "commentsWritten":
			c.CommentsWritten = n
		case "reactionsReceived":
			c.ReactionsReceived = n
		case "cryLaughsReceived":
			c.CryLaughsReceived = n
		case "achievements":
			c.Achievements = n
		}
		counts[userID] = c
	}

	return counts, rows.Err()
}

func GetUsersByIDs(repo *sql.DB, ctx context.Context, userIDs []string) ([]models.User, error) {
	if len(userIDs) == 0 {
		return []models.User{}, nil
	}

	args := make([]any, len(userIDs))
	for i, id := range userIDs {
		args[i] = id
	}

	rows, err := repo.QueryContext(ctx, `
		SELECT id, username, created_at, avatar_type, avatar_url
		FROM users WHERE id IN (`+placeholders(len(userIDs))+`)
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.CreatedAt, &u.AvatarType, &u.AvatarURL); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, rows.Err()
}

// XPEvent is one thing that earned a user XP. Kind is one of ActivityCounts' JSON names.
type XPEvent struct {
	Kind string
	At   time.Time
}

// GetXPEventsSince returns what earned the user XP from since on, oldest first. It splits
// time the same way GetActivityCounts does, so counts up to since plus these events make
// the user's total.
func GetXPEventsSince(repo *sql.DB, ctx context.Context, userID string, since time.Time) ([]XPEvent, error) {
	day, at := utils.GetFormattedDate(since), since.UTC().Format(sqliteTimestamp)
	var kind, when string
	var parseErr error
	events := []XPEvent{}
	// datetime() normalizes every timestamp to sqliteTimestamp, since a UNION loses the
	// column types the driver would otherwise parse by
	err := queryEach(repo, ctx, `
		WITH ro AS (`+reactionOwners+`)
		SELECT 'drawings', datetime(created_at) AS at FROM user_submissions WHERE user_id = ? AND day >= ?
		UNION ALL
		SELECT 'commentsWritten', datetime(c.created_at) FROM comments c
		JOIN user_submissions s ON s.id = c.submission_id
		WHERE c.user_id = ? AND s.user_id != c.user_id AND c.created_at >= ?
		UNION ALL
		SELECT 'reactionsGiven', datetime(created_at) FROM ro WHERE reactor = ? AND owner != reactor AND created_at >= ?
		UNION ALL
		SELECT 'reactionsReceived', datetime(created_at) FROM ro WHERE owner = ? AND owner != reactor AND created_at >= ?
		UNION ALL
		SELECT 'achievements', datetime(created_at) FROM user_achievements WHERE user_id = ? AND created_at >= ?
		ORDER BY at`,
		[]any{userID, day, userID, at, userID, at, userID, at, userID, at},
		[]any{&kind, &when},
		func() {
			t, err := time.Parse(sqliteTimestamp, when)
			parseErr = cmp.Or(parseErr, err)
			events = append(events, XPEvent{Kind: kind, At: t})
		})
	return events, cmp.Or(err, parseErr)
}
