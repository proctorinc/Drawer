package queries

import (
	"cmp"
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"
)

// ActivityCounts is what a user did in a date range. Only social actions aimed at
// someone else count, so reacting to your own drawing earns nothing.
type ActivityCounts struct {
	Drawings       int `json:"drawings"`
	ReactionsGiven int `json:"reactionsGiven"`
	// ReactionsGivenForXP is ReactionsGiven without those past the first
	// ReactionsGivenXPPerDay of a day, which earn nothing
	ReactionsGivenForXP int `json:"-"`
	DrawingsReacted     int `json:"drawingsReacted"` // distinct friends' drawings reacted to
	CommentsWritten     int `json:"commentsWritten"`
	// CommentsWrittenForXP is CommentsWritten without those past the first
	// CommentsWrittenXPPerDay of a day, which earn nothing
	CommentsWrittenForXP int `json:"-"`
	ReactionsReceived    int `json:"reactionsReceived"`
	CryLaughsReceived    int `json:"cryLaughsReceived"`
	CommentsReceived     int `json:"commentsReceived"` // friends' comments on the user's drawings
	Achievements         int `json:"achievements"`
	// AchievementXP is what the achievements earned are worth together
	AchievementXP int `json:"-"`
	// JudgeScores counts the user's doodles the AI judge scored 5 or more, by score in
	// tenths: index 0 is 5.0, index JudgeScoreSteps-1 is 10.0. An array, not a map, so
	// ActivityCounts stays comparable. Drawings are matched on their day.
	JudgeScores [JudgeScoreSteps]int `json:"-"`
	// QuestsCompleted counts the weeks each of WeeklyQuests was finished, in its order.
	// Like JudgeScores, a finish counts at the moment of the step that reached the goal.
	QuestsCompleted [len(WeeklyQuests)]int `json:"-"`
}

// ReactionsGivenXPPerDay is how many reactions a day, on the server's clock, earn XP.
// Reacting more still counts toward quests and achievements, just not XP.
const ReactionsGivenXPPerDay = 5

// reactionsGivenForXP is every reaction someone gave someone else, with xp set when it
// was among the first ReactionsGivenXPPerDay they gave that day. Numbering a day's
// reactions from its start, not from the counted range's, keeps any split of time
// adding up to the same total.
func reactionsGivenForXP() string {
	return `
	SELECT reactor, created_at,
		ROW_NUMBER() OVER (
			PARTITION BY reactor, date(created_at, '` + weekModifier() + `') ORDER BY created_at
		) <= ` + strconv.Itoa(ReactionsGivenXPPerDay) + ` AS xp
	FROM ro WHERE owner != reactor AND for_reactor
`
}

// CommentsWrittenXPPerDay is how many comments a day, on the server's clock, earn XP.
// Commenting more still counts toward quests and achievements, just not XP.
const CommentsWrittenXPPerDay = 5

// commentsWrittenForXP is every comment someone left on someone else's drawing, with xp
// set when it was among the first CommentsWrittenXPPerDay they left that day, numbered
// from the day's start like reactionsGivenForXP. A non-empty `where` (on comments as c)
// limits it to some commenters: numbering is per commenter, so that changes nothing for
// them but saves numbering everyone's comments.
func commentsWrittenForXP(where string) string {
	if where != "" {
		where = " AND " + where
	}
	return `
	SELECT c.user_id, c.created_at,
		ROW_NUMBER() OVER (
			PARTITION BY c.user_id, date(c.created_at, '` + weekModifier() + `') ORDER BY c.created_at
		) <= ` + strconv.Itoa(CommentsWrittenXPPerDay) + ` AS xp
	FROM comments c JOIN user_submissions s ON s.id = c.submission_id
	WHERE s.user_id != c.user_id AND ` + countedAt("c.user_id", "c.created_at") + where + `
`
}

// WeeklyQuest is a goal that starts over every Monday, on the server's clock
type WeeklyQuest struct {
	ID   string
	Goal int
}

// WeeklyQuests are the goals behind the trophy page's quests. questSteps counts each
// one's steps.
var WeeklyQuests = [...]WeeklyQuest{
	{"draw-5", 5},
	{"react-3", 3},
	{"comment-3", 3},
	{"get-comment", 1},
}

// QuestsStartWeek is the Monday of the week weekly quests launched. Weeks before it
// had no quests, so nothing finished in them counts or earns XP.
const QuestsStartWeek = "2026-11-16"

// achievementKind is the kind prefix GetXPEventsSince gives an earned achievement,
// followed by its XP, e.g. "achievement:25"
const achievementKind = "achievement:"

// AchievementXP parses an earned achievement's kind into its XP
func AchievementXP(kind string) (int, bool) {
	rest, ok := strings.CutPrefix(kind, achievementKind)
	if !ok {
		return 0, false
	}
	xp, err := strconv.Atoi(rest)
	return xp, err == nil
}

// questKind is the kind prefix GetXPEventsSince gives a finished quest, followed by its
// ID, e.g. "quest:draw-5"
const questKind = "quest:"

// QuestIndex is the index in WeeklyQuests of a quest ID, or of a finished quest's kind
func QuestIndex(idOrKind string) (int, bool) {
	id := strings.TrimPrefix(idOrKind, questKind)
	for i, q := range WeeklyQuests {
		if q.ID == id {
			return i, true
		}
	}
	return 0, false
}

// JudgeScoreSteps is how many one-decimal scores there are from 5.0 to 10.0
const JudgeScoreSteps = 51

// judgeKind is the kind prefix GetActivityCounts and GetXPEventsSince give a judged
// doodle, followed by its score in tenths, e.g. "judge87" for 8.7
const judgeKind = "judge"

// judgedScore is what a review's score is worth in XP. For a judge that scores backwards (the
// Grinch) it's how mad he got, 10 minus his score: his high scores go to lazy doodles, and
// drawing well enough to make him furious is the point.
const judgedScore = `CASE WHEN p.scores_backwards = 1 THEN ROUND(10 - r.score, 1) ELSE r.score END`

// judgedDoodles is each doodle whose judge's score is worth 5 or more, in tenths
var judgedDoodles = `
	SELECT s.user_id, s.day, CAST(ROUND(` + judgedScore + ` * 10) AS INTEGER) AS tenths, r.updated_at
	FROM ai_reviews r JOIN user_submissions s ON s.id = r.submission_id
	JOIN ai_personalities p ON p.id = r.personality_id
	WHERE r.status = 'done' AND ` + judgedScore + ` >= 5 AND ` + countedDay("s.user_id", "s.day") + `
`

// JudgeScoreIndex parses a judged-doodle kind into its JudgeScores index
func JudgeScoreIndex(kind string) (int, bool) {
	rest, ok := strings.CutPrefix(kind, judgeKind)
	if !ok {
		return 0, false
	}
	tenths, err := strconv.Atoi(rest)
	if i := tenths - 50; err == nil && i >= 0 && i < JudgeScoreSteps {
		return i, true
	}
	return 0, false
}

// Bounds wide enough to cover all of time, for lifetime totals.
var (
	BeginningOfTime = time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC)
	EndOfTime       = time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC)
)

// sqliteTimestamp is how CURRENT_TIMESTAMP writes created_at, always in UTC.
const sqliteTimestamp = "2006-01-02 15:04:05"

// reactionOwners resolves who owns the drawing or comment each reaction is on, and
// whether it counts toward the reactor's stats (for_reactor) and the owner's
// (for_owner), which their stats start days decide.
func reactionOwners() string {
	return reactionOwnersWhere("1")
}

// reactionOwnersWhere is reactionOwners for just the reactions matching `where` (on
// reactions as r). Filter here rather than on ro: SQLite can't push a filter past the
// window functions that number ro's rows.
func reactionOwnersWhere(where string) string {
	return `
	SELECT reactor, owner, reaction_id, content_type, content_id, created_at,
		` + countedAt("reactor", "created_at") + ` AS for_reactor,
		` + countedAt("owner", "created_at") + ` AS for_owner
	FROM (
		SELECT r.user_id AS reactor, COALESCE(s.user_id, cs.user_id) AS owner, r.reaction_id,
			r.content_type, r.content_id, r.created_at
		FROM reactions r
		LEFT JOIN user_submissions s ON r.content_type = 'submission' AND s.id = r.content_id
		LEFT JOIN comments cs ON r.content_type = 'comment' AND cs.id = r.content_id
		WHERE ` + where + `
	)
`
}

// reactionsReceived is reactions on the drawings and comments of the users in `in` made
// in [?, ?), each with whether it counts toward its owner's stats (for_owner). It starts
// from the owners' side, since ro's owner is computed and filtering on it reads every
// reaction ever made. Takes its arguments as: users, from, to, users, from, to.
func reactionsReceived(in string) string {
	return `
	SELECT reactor, owner, reaction_id, created_at,
		` + countedAt("owner", "created_at") + ` AS for_owner
	FROM (
		SELECT r.user_id AS reactor, s.user_id AS owner, r.reaction_id, r.created_at
		FROM user_submissions s
		JOIN reactions r ON r.content_id = s.id AND r.content_type = 'submission'
		WHERE s.user_id IN ` + in + ` AND r.created_at >= ? AND r.created_at < ?
		UNION ALL
		SELECT r.user_id, c.user_id, r.reaction_id, r.created_at
		FROM comments c
		-- comments.id is an INTEGER and content_id TEXT; the CAST lets this use the index
		JOIN reactions r ON r.content_id = CAST(c.id AS TEXT) AND r.content_type = 'comment'
		WHERE c.user_id IN ` + in + ` AND r.created_at >= ? AND r.created_at < ?
	)
`
}

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
		WITH ro AS (` + reactionOwnersWhere("r.user_id IN "+in) + `),
			rg AS (` + reactionsGivenForXP() + `),
			cw AS (` + commentsWrittenForXP("c.user_id IN "+in) + `),
			received AS (` + reactionsReceived(in) + `)
		SELECT user_id, 'drawings', COUNT(*) FROM user_submissions
		WHERE user_id IN ` + in + ` AND day >= ? AND day < ? AND ` + countedDay("user_id", "day") + `
		GROUP BY user_id
		UNION ALL
		SELECT reactor, 'reactionsGivenForXP', COUNT(*) FROM rg
		WHERE reactor IN ` + in + ` AND xp AND created_at >= ? AND created_at < ?
		GROUP BY reactor
		UNION ALL
		SELECT user_id, '` + judgeKind + `' || tenths, COUNT(*) FROM (` + judgedDoodles + `)
		WHERE user_id IN ` + in + ` AND day >= ? AND day < ?
		GROUP BY user_id, tenths
		UNION ALL
		SELECT reactor, 'reactionsGiven', COUNT(*) FROM ro
		WHERE reactor IN ` + in + ` AND owner != reactor AND for_reactor AND created_at >= ? AND created_at < ?
		GROUP BY reactor
		UNION ALL
		SELECT reactor, 'drawingsReacted', COUNT(DISTINCT content_id) FROM ro
		WHERE reactor IN ` + in + ` AND owner != reactor AND for_reactor AND content_type = 'submission'
			AND created_at >= ? AND created_at < ?
		GROUP BY reactor
		UNION ALL
		SELECT c.user_id, 'commentsWritten', COUNT(*) FROM comments c
		JOIN user_submissions s ON s.id = c.submission_id
		WHERE c.user_id IN ` + in + ` AND s.user_id != c.user_id AND c.created_at >= ? AND c.created_at < ?
			AND ` + countedAt("c.user_id", "c.created_at") + `
		GROUP BY c.user_id
		UNION ALL
		SELECT owner, 'reactionsReceived', COUNT(*) FROM received
		WHERE owner != reactor AND for_owner
		GROUP BY owner
		UNION ALL
		SELECT owner, 'cryLaughsReceived', COUNT(*) FROM received
		WHERE owner != reactor AND for_owner AND reaction_id = 'cry-laugh'
		GROUP BY owner
		UNION ALL
		SELECT s.user_id, 'commentsReceived', COUNT(*) FROM comments c
		JOIN user_submissions s ON s.id = c.submission_id
		WHERE s.user_id IN ` + in + ` AND s.user_id != c.user_id AND c.created_at >= ? AND c.created_at < ?
			AND ` + countedAt("s.user_id", "c.created_at") + `
		GROUP BY s.user_id
		UNION ALL
		SELECT user_id, 'achievements', COUNT(*) FROM user_achievements
		WHERE user_id IN ` + in + ` AND created_at >= ? AND created_at < ?
			AND ` + countedAt("user_id", "created_at") + `
		GROUP BY user_id
		UNION ALL
		SELECT ua.user_id, 'achievementXP', SUM(a.xp) FROM user_achievements ua
		JOIN achievements a ON a.id = ua.achievement_id
		WHERE ua.user_id IN ` + in + ` AND ua.created_at >= ? AND ua.created_at < ?
			AND ` + countedAt("ua.user_id", "ua.created_at") + `
		GROUP BY ua.user_id
		UNION ALL
		SELECT user_id, 'commentsWrittenForXP', COUNT(*) FROM cw
		WHERE user_id IN ` + in + ` AND xp AND created_at >= ? AND created_at < ?
		GROUP BY user_id
	`

	ids := make([]any, len(userIDs))
	for i, id := range userIDs {
		ids[i] = id
	}
	// Drawings and judged doodles go by day, everything else by time
	days := []any{utils.GetFormattedDate(from), utils.GetFormattedDate(to)}
	times := []any{from.UTC().Format(sqliteTimestamp), to.UTC().Format(sqliteTimestamp)}
	args := slices.Concat(
		ids, ids, ids, times, ids, times, // ro, cw, received
		ids, days, ids, times, ids, days, // drawings, reactionsGivenForXP, judged doodles
		ids, times, ids, times, ids, times, // reactionsGiven, drawingsReacted, commentsWritten
		ids, times, ids, times, ids, times, ids, times, // commentsReceived, achievements, achievementXP, commentsWrittenForXP
	)

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
		case "reactionsGivenForXP":
			c.ReactionsGivenForXP = n
		case "drawingsReacted":
			c.DrawingsReacted = n
		case "commentsWritten":
			c.CommentsWritten = n
		case "commentsWrittenForXP":
			c.CommentsWrittenForXP = n
		case "reactionsReceived":
			c.ReactionsReceived = n
		case "cryLaughsReceived":
			c.CryLaughsReceived = n
		case "commentsReceived":
			c.CommentsReceived = n
		case "achievements":
			c.Achievements = n
		case "achievementXP":
			c.AchievementXP = n
		default:
			if i, ok := JudgeScoreIndex(kind); ok {
				c.JudgeScores[i] = n
			}
		}
		counts[userID] = c
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	err = eachQuestCompletion(repo, ctx, userIDs, from, to, func(userID string, quest int, _ time.Time) {
		c := counts[userID]
		c.QuestsCompleted[quest]++
		counts[userID] = c
	})
	return counts, err
}

// weekModifier shifts a UTC created_at onto the server's clock, which weekBounds splits
// weeks by. Drawings' days are on that clock already.
func weekModifier() string {
	_, offset := time.Now().Zone()
	return fmt.Sprintf("%+d seconds", offset)
}

// eachQuestCompletion calls each for every weekly quest a user finished in [from, to),
// in a week from QuestsStartWeek on:
// the quest's WeeklyQuests index and when the step that reached its goal happened. A
// step counts toward the week it happened in, so each week's progress starts over.
func eachQuestCompletion(repo *sql.DB, ctx context.Context, userIDs []string, from, to time.Time, each func(userID string, quest int, at time.Time)) error {
	if len(userIDs) == 0 {
		return nil
	}
	in := "(" + placeholders(len(userIDs)) + ")"
	week := func(col string) string { return "date(" + col + ", ?, '-6 days', 'weekday 1')" }
	goals := make([]string, len(WeeklyQuests))
	for i, q := range WeeklyQuests {
		goals[i] = fmt.Sprintf("SELECT %d AS quest, %d AS goal", i, q.Goal)
	}

	// The steps follow GetActivityCounts' rules for the counts the quests show
	query := `
		WITH ro AS (` + reactionOwners() + `),
		steps AS (
			SELECT user_id, 0 AS quest, date(day, '-6 days', 'weekday 1') AS week, created_at AS at
			FROM user_submissions WHERE user_id IN ` + in + ` AND ` + countedDay("user_id", "day") + `
			UNION ALL
			SELECT reactor, 1, week, MIN(created_at) FROM (
				SELECT reactor, content_id, created_at, ` + week("created_at") + ` AS week FROM ro
				WHERE reactor IN ` + in + ` AND owner != reactor AND for_reactor AND content_type = 'submission'
					AND ` + eventReactionsOnly("ro") + `
			) GROUP BY reactor, content_id, week
			UNION ALL
			SELECT c.user_id, 2, ` + week("c.created_at") + `, c.created_at FROM comments c
			JOIN user_submissions s ON s.id = c.submission_id
			WHERE c.user_id IN ` + in + ` AND s.user_id != c.user_id
				AND ` + countedAt("c.user_id", "c.created_at") + `
			UNION ALL
			SELECT s.user_id, 3, ` + week("c.created_at") + `, c.created_at FROM comments c
			JOIN user_submissions s ON s.id = c.submission_id
			WHERE s.user_id IN ` + in + ` AND s.user_id != c.user_id
				AND ` + countedAt("s.user_id", "c.created_at") + `
		),
		numbered AS (
			SELECT user_id, quest, week, datetime(at) AS done_at,
				ROW_NUMBER() OVER (PARTITION BY user_id, quest, week ORDER BY datetime(at)) AS step
			FROM steps
		)
		SELECT n.user_id, n.quest, n.done_at FROM numbered n
		JOIN (` + strings.Join(goals, " UNION ALL ") + `) g ON g.quest = n.quest AND g.goal = n.step
		WHERE n.week >= ? AND n.done_at >= ? AND n.done_at < ?`

	mod := weekModifier()
	args := []any{}
	for i := range 4 {
		if i > 0 {
			args = append(args, mod)
		}
		for _, id := range userIDs {
			args = append(args, id)
		}
	}
	args = append(args, QuestsStartWeek, from.UTC().Format(sqliteTimestamp), to.UTC().Format(sqliteTimestamp))

	var userID, when string
	var quest int
	var parseErr error
	err := queryEach(repo, ctx, query, args, []any{&userID, &quest, &when}, func() {
		t, err := time.Parse(sqliteTimestamp, when)
		parseErr = cmp.Or(parseErr, err)
		if quest >= 0 && quest < len(WeeklyQuests) {
			each(userID, quest, t)
		}
	})
	return cmp.Or(err, parseErr)
}

// eventReactionsOnly keeps a reaction from table t unless it was given while an event
// with its own reactions ran and isn't one of them: the event swaps the react quest
// for its festive version (see eventQuests), so plain reactions don't count then.
func eventReactionsOnly(t string) string {
	return `NOT EXISTS (
		SELECT 1 FROM events e
		WHERE datetime(` + t + `.created_at) >= datetime(e.starts_at) AND datetime(` + t + `.created_at) < datetime(e.ends_at)
			AND EXISTS (SELECT 1 FROM event_reactions er WHERE er.event_id = e.id)
			AND ` + t + `.reaction_id NOT IN (SELECT reaction_id FROM event_reactions er WHERE er.event_id = e.id)
	)`
}

// GetAchievementXPRange is the least and most an achievement is worth
func GetAchievementXPRange(repo *sql.DB, ctx context.Context) (low, high int, err error) {
	err = repo.QueryRowContext(ctx, `SELECT COALESCE(MIN(xp), 0), COALESCE(MAX(xp), 0) FROM achievements`).Scan(&low, &high)
	return low, high, err
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
		SELECT id, username, created_at, avatar_type, avatar_url, decoration, color_hue
		FROM users WHERE id IN (`+placeholders(len(userIDs))+`)
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.CreatedAt, &u.AvatarType, &u.AvatarURL, &u.Decoration, &u.ColorHue); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, rows.Err()
}

// XPEvent is one thing that earned a user XP. Kind is one of ActivityCounts' JSON names,
// a judged doodle's kind (see JudgeScoreIndex), which is at when it was judged, or a
// finished quest's (see QuestIndex).
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
		WITH ro AS (`+reactionOwners()+`), rg AS (`+reactionsGivenForXP()+`),
			cw AS (`+commentsWrittenForXP("")+`)
		SELECT 'drawings', datetime(created_at) AS at FROM user_submissions
		WHERE user_id = ? AND day >= ? AND `+countedDay("user_id", "day")+`
		UNION ALL
		SELECT 'commentsWritten', datetime(created_at) FROM cw WHERE user_id = ? AND xp AND created_at >= ?
		UNION ALL
		SELECT 'reactionsGiven', datetime(created_at) FROM rg WHERE reactor = ? AND xp AND created_at >= ?
		UNION ALL
		SELECT 'reactionsReceived', datetime(created_at) FROM ro WHERE owner = ? AND owner != reactor AND for_owner AND created_at >= ?
		UNION ALL
		SELECT '`+achievementKind+`' || a.xp, datetime(ua.created_at) FROM user_achievements ua
		JOIN achievements a ON a.id = ua.achievement_id
		WHERE ua.user_id = ? AND ua.created_at >= ? AND `+countedAt("ua.user_id", "ua.created_at")+`
		UNION ALL
		SELECT '`+judgeKind+`' || tenths, datetime(updated_at) FROM (`+judgedDoodles+`) WHERE user_id = ? AND day >= ?
		ORDER BY at`,
		[]any{userID, day, userID, at, userID, at, userID, at, userID, at, userID, day},
		[]any{&kind, &when},
		func() {
			t, err := time.Parse(sqliteTimestamp, when)
			parseErr = cmp.Or(parseErr, err)
			events = append(events, XPEvent{Kind: kind, At: t})
		})
	if err := cmp.Or(err, parseErr); err != nil {
		return nil, err
	}

	err = eachQuestCompletion(repo, ctx, []string{userID}, since, EndOfTime, func(_ string, quest int, t time.Time) {
		events = append(events, XPEvent{Kind: questKind + WeeklyQuests[quest].ID, At: t})
	})
	slices.SortStableFunc(events, func(a, b XPEvent) int { return a.At.Compare(b.At) })
	return events, err
}

// EventActivityCounts is what a user did in [from, to) that only an event makes possible:
// using its reactions and earning its stickers. Like ActivityCounts, reactions only count
// when they're aimed at someone else.
type EventActivityCounts struct {
	ReactionsGiven    int
	DrawingsReacted   int // distinct friends' drawings given an event reaction
	ReactionsReceived int
	Stickers          int
	StickerXP         int // what the stickers earned are worth together
	// StickersOffered is how many stickers the event has, earned or not
	StickersOffered int
}

func GetEventActivityCounts(repo *sql.DB, ctx context.Context, userID, eventID string, from, to time.Time) (EventActivityCounts, error) {
	fromAt, toAt := from.UTC().Format(sqliteTimestamp), to.UTC().Format(sqliteTimestamp)
	var c EventActivityCounts
	err := repo.QueryRowContext(ctx, `
		WITH ro AS (`+reactionOwners()+`),
		er AS (
			SELECT * FROM ro
			WHERE owner != reactor AND created_at >= ? AND created_at < ?
				AND reaction_id IN (SELECT reaction_id FROM event_reactions WHERE event_id = ?)
		)
		SELECT
			(SELECT COUNT(*) FROM er WHERE reactor = ? AND for_reactor),
			(SELECT COUNT(DISTINCT content_id) FROM er WHERE reactor = ? AND for_reactor AND content_type = 'submission'),
			(SELECT COUNT(*) FROM er WHERE owner = ? AND for_owner),
			(SELECT COUNT(*) FROM user_achievements ua
				JOIN event_achievements ea ON ea.achievement_id = ua.achievement_id
				WHERE ua.user_id = ? AND ea.event_id = ? AND ua.created_at >= ? AND ua.created_at < ?),
			(SELECT COALESCE(SUM(a.xp), 0) FROM user_achievements ua
				JOIN event_achievements ea ON ea.achievement_id = ua.achievement_id
				JOIN achievements a ON a.id = ua.achievement_id
				WHERE ua.user_id = ? AND ea.event_id = ? AND ua.created_at >= ? AND ua.created_at < ?),
			(SELECT COUNT(*) FROM event_achievements WHERE event_id = ?)`,
		fromAt, toAt, eventID, userID, userID, userID, userID, eventID, fromAt, toAt,
		userID, eventID, fromAt, toAt, eventID,
	).Scan(&c.ReactionsGiven, &c.DrawingsReacted, &c.ReactionsReceived, &c.Stickers, &c.StickerXP, &c.StickersOffered)
	return c, err
}
