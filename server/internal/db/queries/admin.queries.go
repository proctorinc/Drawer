package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"errors"
	"time"
)

// isoTime renders a created_at column as an ISO-8601 UTC string. It reads both the
// CURRENT_TIMESTAMP format and Go's offset format, and keeps its meaning inside a UNION,
// where SQLite drops the column's declared type.
func isoTime(column string) string {
	return "strftime('%Y-%m-%dT%H:%M:%SZ', " + column + ")"
}

// AdminUser is a user with the totals admins scan the user list for
type AdminUser struct {
	models.Account
	Drawings       int     `json:"drawings"`
	Friends        int     `json:"friends"`
	Achievements   int     `json:"achievements"`
	LastDrawnDay   *string `json:"lastDrawnDay"`
	PushSubscribed bool    `json:"pushSubscribed"`
}

func GetAdminUsers(repo *sql.DB, ctx context.Context) ([]AdminUser, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT u.id, u.username, u.email, u.role, u.created_at, u.avatar_type, u.avatar_url, u.decoration,
			(SELECT COUNT(*) FROM user_submissions s WHERE s.user_id = u.id),
			(SELECT COUNT(*) FROM friendships f WHERE f.state = 'accepted' AND (f.user1 = u.id OR f.user2 = u.id)),
			(SELECT COUNT(*) FROM user_achievements ua WHERE ua.user_id = u.id),
			(SELECT MAX(s.day) FROM user_submissions s WHERE s.user_id = u.id),
			EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id)
		FROM users u
		ORDER BY u.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []AdminUser{}
	for rows.Next() {
		var u models.User
		var a AdminUser
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.CreatedAt, &u.AvatarType, &u.AvatarURL, &u.Decoration,
			&a.Drawings, &a.Friends, &a.Achievements, &a.LastDrawnDay, &a.PushSubscribed); err != nil {
			return nil, err
		}
		a.Account = u.Account()
		users = append(users, a)
	}
	return users, rows.Err()
}

// AdminPrompt is a daily prompt, past or future, with how many people drew it
type AdminPrompt struct {
	models.DailyPrompt
	Submissions int `json:"submissions"`
}

func GetAllPrompts(repo *sql.DB, ctx context.Context) ([]AdminPrompt, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT dp.day, dp.colors, dp.prompt,
			u.id, u.username, u.created_at, u.avatar_type, u.avatar_url, u.decoration,
			(SELECT COUNT(*) FROM user_submissions s WHERE s.day = dp.day)
		FROM daily_prompts dp
		LEFT JOIN users u ON u.id = dp.created_by
		ORDER BY dp.day DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	prompts := []AdminPrompt{}
	for rows.Next() {
		var p AdminPrompt
		var colors string
		var by nullableUser
		dest := append([]any{&p.Day, &colors, &p.Prompt}, by.dest()...)
		if err := rows.Scan(append(dest, &p.Submissions)...); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(colors), &p.Colors); err != nil {
			p.Colors = []string{}
		}
		p.CreatedBy = by.user()
		prompts = append(prompts, p)
	}
	return prompts, rows.Err()
}

// nullableUser scans a LEFT JOINed user, which may be all NULLs
type nullableUser struct {
	id, username, avatarType, avatarURL, decoration sql.NullString
	createdAt                                       sql.NullTime
}

// dest scans id, username, created_at, avatar_type, avatar_url, decoration in that order
func (n *nullableUser) dest() []any {
	return []any{&n.id, &n.username, &n.createdAt, &n.avatarType, &n.avatarURL, &n.decoration}
}

func (n *nullableUser) user() *models.User {
	if !n.id.Valid {
		return nil
	}
	return &models.User{
		ID:         n.id.String,
		Username:   n.username.String,
		CreatedAt:  n.createdAt.Time,
		AvatarType: n.avatarType.String,
		AvatarURL:  n.avatarURL.String,
		Decoration: n.decoration.String,
	}
}

// AdminSubmission is a drawing as it appears in the admin gallery
type AdminSubmission struct {
	ID        string      `json:"id"`
	Day       string      `json:"day"`
	Prompt    string      `json:"prompt"`
	Colors    []string    `json:"colors"`
	User      models.User `json:"user"`
	ImageURL  string      `json:"imageUrl"`
	CreatedAt string      `json:"createdAt"`
	Reactions int         `json:"reactions"`
	Comments  int         `json:"comments"`
}

// GetRecentSubmissions returns the newest drawings, most recent day first
func GetRecentSubmissions(repo *sql.DB, ctx context.Context, cfg *config.Config, limit int) ([]AdminSubmission, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT s.id, s.day, COALESCE(dp.prompt, ''), COALESCE(dp.colors, '[]'),
			u.id, u.username, u.created_at, u.avatar_type, u.avatar_url, u.decoration,
			`+isoTime("s.created_at")+`,
			(SELECT COUNT(*) FROM reactions r WHERE r.content_type = 'submission' AND r.content_id = s.id),
			(SELECT COUNT(*) FROM comments c WHERE c.submission_id = s.id)
		FROM user_submissions s
		JOIN users u ON u.id = s.user_id
		LEFT JOIN daily_prompts dp ON dp.day = s.day
		ORDER BY s.day DESC, s.created_at DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	submissions := []AdminSubmission{}
	for rows.Next() {
		var s AdminSubmission
		var colors string
		u := &s.User
		if err := rows.Scan(&s.ID, &s.Day, &s.Prompt, &colors, &u.ID, &u.Username, &u.CreatedAt, &u.AvatarType, &u.AvatarURL, &u.Decoration,
			&s.CreatedAt, &s.Reactions, &s.Comments); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(colors), &s.Colors); err != nil {
			s.Colors = []string{}
		}
		s.ImageURL = utils.GetImageUrl(cfg, utils.GetSubmissionFilename(u.ID, s.ID))
		submissions = append(submissions, s)
	}
	return submissions, rows.Err()
}

// AdminAchievement is an achievement with how many people have earned it
type AdminAchievement struct {
	models.Achievement
	EarnedBy int `json:"earnedBy"`
}

func GetAllAchievements(repo *sql.DB, ctx context.Context) ([]AdminAchievement, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT a.id, a.name, a.description, a.image_url, a.achievement_field, a.achievement_value,
			r.id, r.name, r.description, e.slug,
			(SELECT COUNT(*) FROM user_achievements ua WHERE ua.achievement_id = a.id)
		FROM achievements a
		LEFT JOIN reward_unlocks r ON r.achievement_id = a.id
		LEFT JOIN event_achievements ea ON ea.achievement_id = a.id
		LEFT JOIN events e ON e.id = ea.event_id
		ORDER BY e.slug IS NOT NULL, e.slug, a.achievement_field, a.achievement_value`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	achievements := []AdminAchievement{}
	for rows.Next() {
		var a AdminAchievement
		var rewardID, rewardName, rewardDescription, eventSlug sql.NullString
		if err := rows.Scan(&a.ID, &a.Name, &a.Description, &a.ImageURL, &a.AchievementField, &a.AchievementValue,
			&rewardID, &rewardName, &rewardDescription, &eventSlug, &a.EarnedBy); err != nil {
			return nil, err
		}
		if rewardID.Valid {
			a.Reward = &models.RewardUnlock{ID: rewardID.String, Name: rewardName.String, Description: rewardDescription.String}
		}
		if eventSlug.Valid {
			a.EventSlug = &eventSlug.String
		}
		achievements = append(achievements, a)
	}
	return achievements, rows.Err()
}

// AdminReward is an unlockable reward and how many people have it
type AdminReward struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	AchievementID *string `json:"achievementId"`
	// People who earned the achievement that unlocks it
	UnlockedBy int `json:"unlockedBy"`
	// People wearing it now, for decorations
	WornBy int `json:"wornBy"`
}

func GetAllRewards(repo *sql.DB, ctx context.Context) ([]AdminReward, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT r.id, r.name, r.description, r.achievement_id,
			(SELECT COUNT(*) FROM user_achievements ua WHERE ua.achievement_id = r.achievement_id),
			(SELECT COUNT(*) FROM users u WHERE u.decoration = r.id)
		FROM reward_unlocks r
		ORDER BY r.created_at, r.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rewards := []AdminReward{}
	for rows.Next() {
		var r AdminReward
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &r.AchievementID, &r.UnlockedBy, &r.WornBy); err != nil {
			return nil, err
		}
		rewards = append(rewards, r)
	}
	return rewards, rows.Err()
}

// ReactionUsage is how often a reaction has been left on drawings and on comments
type ReactionUsage struct {
	ReactionID  string `json:"reactionId"`
	Submissions int    `json:"submissions"`
	Comments    int    `json:"comments"`
}

func GetReactionUsage(repo *sql.DB, ctx context.Context) ([]ReactionUsage, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT reaction_id,
			SUM(content_type = 'submission'),
			SUM(content_type = 'comment')
		FROM reactions
		GROUP BY reaction_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	usage := []ReactionUsage{}
	for rows.Next() {
		var u ReactionUsage
		if err := rows.Scan(&u.ReactionID, &u.Submissions, &u.Comments); err != nil {
			return nil, err
		}
		usage = append(usage, u)
	}
	return usage, rows.Err()
}

// LogEntry is one thing that happened in the app. TargetID is whoever it was aimed at,
// and SubmissionID the drawing it happened on, when there is one.
type LogEntry struct {
	Kind         string  `json:"kind"`
	At           string  `json:"at"`
	ActorID      string  `json:"-"`
	TargetID     *string `json:"-"`
	Detail       string  `json:"detail"`
	SubmissionID *string `json:"submissionId"`
}

// GetActivityLog returns the newest things anyone did, across every kind of action
func GetActivityLog(repo *sql.DB, ctx context.Context, limit int) ([]LogEntry, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT 'signup', `+isoTime("created_at")+`, id, NULL, username, NULL FROM users
		UNION ALL
		SELECT 'drawing', `+isoTime("s.created_at")+`, s.user_id, NULL, COALESCE(dp.prompt, s.day), s.id
		FROM user_submissions s LEFT JOIN daily_prompts dp ON dp.day = s.day
		UNION ALL
		SELECT 'comment', `+isoTime("c.created_at")+`, c.user_id, s.user_id, c.text, c.submission_id
		FROM comments c JOIN user_submissions s ON s.id = c.submission_id
		UNION ALL
		SELECT 'reaction', `+isoTime("r.created_at")+`, r.user_id, COALESCE(s.user_id, c.user_id), r.reaction_id,
			COALESCE(s.id, c.submission_id)
		FROM reactions r
		LEFT JOIN user_submissions s ON r.content_type = 'submission' AND s.id = r.content_id
		LEFT JOIN comments c ON r.content_type = 'comment' AND c.id = r.content_id
		UNION ALL
		SELECT 'friend_request', `+isoTime("created_at")+`, inviter_id,
			CASE WHEN inviter_id = user1 THEN user2 ELSE user1 END, state, NULL FROM friendships
		UNION ALL
		SELECT 'friend_accepted', `+isoTime("accepted_at")+`,
			CASE WHEN inviter_id = user1 THEN user2 ELSE user1 END, inviter_id, '', NULL
		FROM friendships WHERE accepted_at IS NOT NULL
		UNION ALL
		SELECT 'poke', `+isoTime("created_at")+`, poker_id, pokee_id, day, NULL FROM pokes
		UNION ALL
		SELECT 'achievement', `+isoTime("ua.created_at")+`, ua.user_id, NULL, a.name, NULL
		FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
		UNION ALL
		SELECT 'suggestion', `+isoTime("created_at")+`, user_id, NULL, prompt, NULL FROM prompt_suggestions
		WHERE user_id IS NOT NULL
		ORDER BY 2 DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []LogEntry{}
	for rows.Next() {
		var e LogEntry
		var at sql.NullString
		if err := rows.Scan(&e.Kind, &at, &e.ActorID, &e.TargetID, &e.Detail, &e.SubmissionID); err != nil {
			return nil, err
		}
		e.At = at.String
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// EventStanding is how one player did in an event
type EventStanding struct {
	User              models.User `json:"user"`
	Doodles           int         `json:"doodles"`
	CountdownDoodles  int         `json:"countdownDoodles"`
	ReactionsReceived int         `json:"reactionsReceived"`
}

// GetEventStandings ranks everyone who drew during [firstDay, lastDay] by doodles, counting
// separately the ones inside the countdown's [countdownFirst, countdownLast].
func GetEventStandings(repo *sql.DB, ctx context.Context, firstDay, lastDay, countdownFirst, countdownLast string) ([]EventStanding, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT u.id, u.username, u.created_at, u.avatar_type, u.avatar_url, u.decoration,
			(SELECT COUNT(*) FROM user_submissions s WHERE s.user_id = u.id AND s.day BETWEEN ? AND ?) AS doodles,
			(SELECT COUNT(*) FROM user_submissions s WHERE s.user_id = u.id AND s.day BETWEEN ? AND ?),
			`+reactionsReceivedSQL+` AS reactions_received
		FROM users u
		WHERE doodles > 0
		ORDER BY doodles DESC, reactions_received DESC, u.username ASC`,
		firstDay, lastDay, countdownFirst, countdownLast, firstDay, lastDay)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	standings := []EventStanding{}
	for rows.Next() {
		var s EventStanding
		u := &s.User
		if err := rows.Scan(&u.ID, &u.Username, &u.CreatedAt, &u.AvatarType, &u.AvatarURL, &u.Decoration,
			&s.Doodles, &s.CountdownDoodles, &s.ReactionsReceived); err != nil {
			return nil, err
		}
		standings = append(standings, s)
	}
	return standings, rows.Err()
}

// GetReactionUsageBetween counts each reaction left in [from, to)
func GetReactionUsageBetween(repo *sql.DB, ctx context.Context, from, to time.Time) ([]ReactionUsage, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT reaction_id,
			SUM(content_type = 'submission'),
			SUM(content_type = 'comment')
		FROM reactions
		WHERE datetime(created_at) >= ? AND datetime(created_at) < ?
		GROUP BY reaction_id
		ORDER BY COUNT(*) DESC`,
		from.UTC().Format(sqliteTimestamp), to.UTC().Format(sqliteTimestamp))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	usage := []ReactionUsage{}
	for rows.Next() {
		var u ReactionUsage
		if err := rows.Scan(&u.ReactionID, &u.Submissions, &u.Comments); err != nil {
			return nil, err
		}
		usage = append(usage, u)
	}
	return usage, rows.Err()
}

// CountCommentsBetween counts comments written in [from, to)
func CountCommentsBetween(repo *sql.DB, ctx context.Context, from, to time.Time) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM comments WHERE datetime(created_at) >= ? AND datetime(created_at) < ?`,
		from.UTC().Format(sqliteTimestamp), to.UTC().Format(sqliteTimestamp)).Scan(&count)
	return count, err
}

// GetEventByID returns the event with this id, or sql.ErrNoRows
func GetEventByID(repo *sql.DB, ctx context.Context, id string) (models.Event, error) {
	return getEvent(repo, ctx, `WHERE id = ?`, id)
}

// ErrDayTaken means the day already has a prompt
var ErrDayTaken = errors.New("that day already has a prompt")

// AcceptPromptSuggestion schedules a suggestion as day's prompt, credited to whoever
// suggested it, and takes it off the list. It never replaces a prompt: if day already
// has one it returns ErrDayTaken, and if the suggestion is gone, sql.ErrNoRows.
func AcceptPromptSuggestion(repo *sql.DB, ctx context.Context, suggestionID, day, prompt string, colors []string) error {
	colorsJSON, err := json.Marshal(colors)
	if err != nil {
		return err
	}
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var suggester sql.NullString
	if err := tx.QueryRowContext(ctx, `SELECT user_id FROM prompt_suggestions WHERE id = ?`, suggestionID).Scan(&suggester); err != nil {
		return err
	}

	result, err := tx.ExecContext(ctx, `
		INSERT INTO daily_prompts (day, colors, prompt, created_by) VALUES (?, ?, ?, ?)
		ON CONFLICT (day) DO NOTHING`, day, string(colorsJSON), prompt, suggester)
	if err != nil {
		return err
	}
	if added, err := result.RowsAffected(); err != nil {
		return err
	} else if added == 0 {
		return ErrDayTaken
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM prompt_suggestions WHERE id = ?`, suggestionID); err != nil {
		return err
	}
	return tx.Commit()
}

// DeletePromptSuggestion removes a suggestion, or returns sql.ErrNoRows if there's none
func DeletePromptSuggestion(repo *sql.DB, ctx context.Context, suggestionID string) error {
	result, err := repo.ExecContext(ctx, `DELETE FROM prompt_suggestions WHERE id = ?`, suggestionID)
	if err != nil {
		return err
	}
	if deleted, err := result.RowsAffected(); err != nil {
		return err
	} else if deleted == 0 {
		return sql.ErrNoRows
	}
	return nil
}
