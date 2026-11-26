package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"slices"
	"time"
)

// activityWindow is how far back the activity feed looks
const activityWindow = "datetime('now', '-7 days')"

// activityUserColumns selects a user from the users table under the given alias, in activityUserDest's order
func activityUserColumns(alias string) string {
	return alias + ".id, " + alias + ".username, " + alias + ".email, " + alias + ".created_at, " +
		alias + ".avatar_type, " + alias + ".avatar_url, " + alias + ".decoration, " + alias + ".color_hue"
}

func activityUserDest(u *models.User) []any {
	return []any{&u.ID, &u.Username, &u.Email, &u.CreatedAt, &u.AvatarType, &u.AvatarURL, &u.Decoration, &u.ColorHue}
}

// queryEach runs a query and, for each row, scans it into dest and calls each
func queryEach(repo *sql.DB, ctx context.Context, query string, args []any, dest []any, each func()) error {
	rows, err := repo.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		if err := rows.Scan(dest...); err != nil {
			return err
		}
		each()
	}
	return rows.Err()
}

// groups folds newest-first rows into one activity per key, so a busy drawing is one
// row rather than one per comment. A key's first row sets its details; later rows only
// add their author and to the count.
type groups struct {
	index map[string]int
	list  []models.Activity
}

// add returns the key's activity, which is only valid until the next add
func (g *groups) add(key string, user models.User, first func() models.Activity) *models.Activity {
	if i, ok := g.index[key]; ok {
		a := &g.list[i]
		a.Count++
		if !slices.ContainsFunc(a.Users, func(u models.User) bool { return u.ID == user.ID }) {
			a.Users = append(a.Users, user)
		}
		return a
	}
	a := first()
	a.ID, a.User, a.Users, a.Count = key, user, []models.User{user}, 1
	g.index[key] = len(g.list)
	g.list = append(g.list, a)
	return &g.list[len(g.list)-1]
}

// GetActivityFeed returns, from the last week: comments on your drawings and on drawings
// you commented on, reactions to your drawings and comments, and friend requests sent to
// you or accepted by others. Comments and reactions are grouped per drawing or comment.
func GetActivityFeed(repo *sql.DB, ctx context.Context, userID string, cfg *config.Config) ([]models.Activity, error) {
	g := &groups{index: map[string]int{}}
	var by, artist models.User
	var subID, prompt string
	submission := func() *models.ActivitySubmission {
		return &models.ActivitySubmission{
			ID:       subID,
			Prompt:   prompt,
			ImageUrl: utils.GetImageUrl(cfg, utils.GetSubmissionFilename(artist.ID, subID)),
			Artist:   artist,
		}
	}

	// On your own drawing you hear about every comment until you reply. After that, and on
	// anyone else's drawing, only comments newer than your latest one count, so replying
	// catches you up on that thread.
	var comment models.Comment
	err := queryEach(repo, ctx, `
		SELECT c.id, c.text, c.created_at, s.id, dp.prompt, `+activityUserColumns("u")+`, `+activityUserColumns("a")+`
		FROM comments c
		JOIN user_submissions s ON s.id = c.submission_id
		JOIN daily_prompts dp ON dp.day = s.day
		JOIN users u ON u.id = c.user_id
		JOIN users a ON a.id = s.user_id
		LEFT JOIN (
			SELECT submission_id, MAX(created_at) AS at FROM comments WHERE user_id = ? GROUP BY submission_id
		) mine ON mine.submission_id = c.submission_id
		WHERE c.user_id != ? AND c.created_at >= `+activityWindow+`
			AND (c.created_at > mine.at OR (mine.at IS NULL AND s.user_id = ?))
		ORDER BY c.created_at DESC`,
		[]any{userID, userID, userID},
		append(append([]any{&comment.ID, &comment.Text, &comment.CreatedAt, &subID, &prompt}, activityUserDest(&by)...), activityUserDest(&artist)...),
		func() {
			g.add("comments-"+subID, by, func() models.Activity {
				newest := comment
				newest.User = by
				return models.Activity{Action: models.ActivityActionComment, Date: comment.CreatedAt, Comment: &newest, Submission: submission()}
			})
		})
	if err != nil {
		return nil, err
	}

	var reactionID string
	var reactedAt time.Time
	addReaction := func(key string, first func() models.Activity) {
		a := g.add(key, by, first)
		if !slices.Contains(a.ReactionIDs, reactionID) {
			a.ReactionIDs = append(a.ReactionIDs, reactionID)
		}
	}

	err = queryEach(repo, ctx, `
		SELECT r.reaction_id, r.created_at, s.id, dp.prompt, `+activityUserColumns("u")+`, `+activityUserColumns("a")+`
		FROM reactions r
		JOIN user_submissions s ON r.content_type = 'submission' AND s.id = r.content_id
		JOIN daily_prompts dp ON dp.day = s.day
		JOIN users u ON u.id = r.user_id
		JOIN users a ON a.id = s.user_id
		WHERE s.user_id = ? AND r.user_id != ? AND r.created_at >= `+activityWindow+`
		ORDER BY r.created_at DESC`,
		[]any{userID, userID},
		append(append([]any{&reactionID, &reactedAt, &subID, &prompt}, activityUserDest(&by)...), activityUserDest(&artist)...),
		func() {
			addReaction("reactions-"+subID, func() models.Activity {
				return models.Activity{Action: models.ActivityActionReaction, Date: reactedAt, Submission: submission()}
			})
		})
	if err != nil {
		return nil, err
	}

	err = queryEach(repo, ctx, `
		SELECT r.reaction_id, r.created_at, c.id, c.text, c.created_at, s.id, dp.prompt, `+activityUserColumns("u")+`, `+activityUserColumns("a")+`
		FROM reactions r
		JOIN comments c ON r.content_type = 'comment' AND c.id = r.content_id
		JOIN user_submissions s ON s.id = c.submission_id
		JOIN daily_prompts dp ON dp.day = s.day
		JOIN users u ON u.id = r.user_id
		JOIN users a ON a.id = s.user_id
		WHERE c.user_id = ? AND r.user_id != ? AND r.created_at >= `+activityWindow+`
		ORDER BY r.created_at DESC`,
		[]any{userID, userID},
		append(append([]any{&reactionID, &reactedAt, &comment.ID, &comment.Text, &comment.CreatedAt, &subID, &prompt}, activityUserDest(&by)...), activityUserDest(&artist)...),
		func() {
			addReaction("comment-reactions-"+comment.ID, func() models.Activity {
				yours := comment
				return models.Activity{Action: models.ActivityActionCommentReaction, Date: reactedAt, Comment: &yours, Submission: submission()}
			})
		})
	if err != nil {
		return nil, err
	}

	activities := g.list

	// Requests sent to you, and your requests that were accepted. A request's other side is
	// whoever isn't you.
	var state string
	var invitedAt time.Time
	var acceptedAt sql.NullTime
	err = queryEach(repo, ctx, `
		SELECT f.state, f.created_at, f.accepted_at, `+activityUserColumns("u")+`
		FROM friendships f
		JOIN users u ON u.id = CASE WHEN f.user1 = ? THEN f.user2 ELSE f.user1 END
		WHERE (f.user1 = ? OR f.user2 = ?) AND (
			(f.state = 'pending' AND f.inviter_id != ? AND f.created_at >= `+activityWindow+`)
			OR (f.state = 'accepted' AND f.inviter_id = ? AND f.accepted_at >= `+activityWindow+`))`,
		[]any{userID, userID, userID, userID, userID},
		append([]any{&state, &invitedAt, &acceptedAt}, activityUserDest(&by)...),
		func() {
			if state == "pending" {
				activities = append(activities, models.Activity{
					ID: "friend-request-" + by.ID, User: by, Action: models.ActivityActionFriendRequest, Date: invitedAt,
				})
			} else {
				activities = append(activities, models.Activity{
					ID: "friend-accepted-" + by.ID, User: by, Action: models.ActivityActionFriendAccepted, Date: acceptedAt.Time,
				})
			}
		})
	if err != nil {
		return nil, err
	}

	return activities, nil
}

// GetActivitySeenAt returns when the user last caught up on their activity, or the zero time if never
func GetActivitySeenAt(repo *sql.DB, ctx context.Context, userID string) (time.Time, error) {
	var seenAt sql.NullTime
	err := repo.QueryRowContext(ctx, `SELECT last_read_date FROM activity_reads WHERE user_id = ?`, userID).Scan(&seenAt)
	if err == sql.ErrNoRows {
		return time.Time{}, nil
	}
	return seenAt.Time, err
}

// SetActivitySeenAt marks everything up to seenAt as read. It never moves backwards,
// so a stale device can't resurrect activity another device already cleared.
func SetActivitySeenAt(repo *sql.DB, ctx context.Context, userID string, seenAt time.Time) error {
	query := `INSERT INTO activity_reads (user_id, last_read_date) VALUES (?, ?)
		ON CONFLICT(user_id) DO UPDATE SET last_read_date = MAX(last_read_date, excluded.last_read_date)`
	_, err := repo.ExecContext(ctx, query, userID, seenAt.UTC())
	return err
}
