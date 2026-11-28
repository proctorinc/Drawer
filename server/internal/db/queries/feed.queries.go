package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/utils"
	"encoding/json"
	"log"
	"slices"
	"strings"
	"time"
)

// FeedPage is a few days of doodles from someone and their friends, newest first.
// NextBefore is the day to ask for the next page with, or "" on the last page.
type FeedPage struct {
	Submissions []*models.UserPromptSubmission `json:"submissions"`
	NextBefore  string                         `json:"nextBefore"`
}

// GetFeedPage returns the viewer's and their friends' doodles from the latest `days` days
// before `before` that anyone drew on. With no `before` it starts from today.
func GetFeedPage(repo *sql.DB, ctx context.Context, cfg *config.Config, viewerID, before string, days int) (FeedPage, error) {
	circle, err := circleArgs(repo, ctx, viewerID)
	if err != nil {
		return FeedPage{}, err
	}
	if before == "" {
		// The day after today, so today is included but tomorrow's prompt isn't
		before = utils.GetFormattedDate(time.Now().AddDate(0, 0, 1))
	}

	// Walks the prompts back from `before`, checking each day for a doodle from the
	// circle, so a page only reads the days it shows rather than everyone's history.
	// date() keeps days plain YYYY-MM-DD, since a driver may hand back typed values as timestamps.
	rows, err := repo.QueryContext(ctx, `
		SELECT date(dp.day) FROM daily_prompts dp
		WHERE dp.day < ? AND EXISTS (
			SELECT 1 FROM user_submissions us
			WHERE us.day = dp.day AND us.user_id IN (`+placeholders(len(circle))+`)
		)
		ORDER BY dp.day DESC
		LIMIT ?`,
		slices.Concat([]any{before}, circle, []any{days + 1})...)
	if err != nil {
		return FeedPage{}, err
	}
	var found []string
	for rows.Next() {
		var day string
		if err := rows.Scan(&day); err != nil {
			rows.Close()
			return FeedPage{}, err
		}
		found = append(found, day)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return FeedPage{}, err
	}

	page := FeedPage{Submissions: []*models.UserPromptSubmission{}}
	if len(found) == 0 {
		return page, nil
	}
	if len(found) > days {
		found = found[:days]
		page.NextBefore = found[days-1]
	}

	page.Submissions, err = loadSubmissions(repo, ctx, cfg,
		`us.user_id IN (`+placeholders(len(circle))+`) AND us.day BETWEEN ? AND ?`,
		slices.Concat(circle, []any{found[len(found)-1], found[0]})...)
	if err != nil {
		return FeedPage{}, err
	}
	return page, HideLockedDrawings(repo, ctx, viewerID, page.Submissions)
}

// GetFeedDay returns the viewer's and their friends' doodles from one day
func GetFeedDay(repo *sql.DB, ctx context.Context, cfg *config.Config, viewerID, day string) ([]*models.UserPromptSubmission, error) {
	circle, err := circleArgs(repo, ctx, viewerID)
	if err != nil {
		return nil, err
	}
	submissions, err := loadSubmissions(repo, ctx, cfg,
		`us.user_id IN (`+placeholders(len(circle))+`) AND us.day = ?`,
		append(circle, day)...)
	if err != nil {
		return nil, err
	}
	return submissions, HideLockedDrawings(repo, ctx, viewerID, submissions)
}

// circleArgs is the viewer and their friends, as query arguments
func circleArgs(repo *sql.DB, ctx context.Context, viewerID string) ([]any, error) {
	friendIDs, err := GetUserFriends(repo, ctx, viewerID)
	if err != nil {
		return nil, err
	}
	circle := []any{viewerID}
	for _, id := range friendIDs {
		circle = append(circle, id)
	}
	return circle, nil
}

// loadSubmissions returns the submissions matching `where` (on user_submissions as us),
// newest first, each with its prompt, comments, reactions, AI review and late/redo flags
func loadSubmissions(repo *sql.DB, ctx context.Context, cfg *config.Config, where string, args ...any) ([]*models.UserPromptSubmission, error) {
	submissions := []*models.UserPromptSubmission{}
	byID := map[string]*models.UserPromptSubmission{}
	var sub models.UserPromptSubmission
	var colorsJSON string
	var creatorID, creatorUsername, creatorEmail, creatorAvatarType, creatorAvatarURL, creatorDecoration sql.NullString
	var creatorCreatedAt sql.NullTime
	var creatorColorHue *int
	err := queryEach(repo, ctx, `
		SELECT us.id, us.day, us.created_at, dp.colors, dp.prompt, `+activityUserColumns("u")+`, `+activityUserColumns("dpu")+`
		FROM user_submissions us
		JOIN daily_prompts dp ON dp.day = us.day
		JOIN users u ON u.id = us.user_id
		LEFT JOIN users dpu ON dpu.id = dp.created_by
		WHERE `+where+`
		ORDER BY us.day DESC, us.created_at DESC`,
		args,
		append([]any{&sub.ID, &sub.Day, &sub.CreatedAt, &colorsJSON, &sub.Prompt}, append(activityUserDest(&sub.User),
			&creatorID, &creatorUsername, &creatorEmail, &creatorCreatedAt, &creatorAvatarType, &creatorAvatarURL, &creatorDecoration, &creatorColorHue)...),
		func() {
			s := sub
			_ = json.Unmarshal([]byte(colorsJSON), &s.Colors)
			s.ImageUrl = utils.GetImageUrl(cfg, utils.GetSubmissionFilename(s.User.ID, s.ID))
			s.Comments, s.Reactions, s.Counts = []models.Comment{}, []models.Reaction{}, []models.ReactionCount{}
			if creatorID.Valid {
				s.CreatedBy = &models.User{
					ID:         creatorID.String,
					Username:   creatorUsername.String,
					Email:      creatorEmail.String,
					CreatedAt:  creatorCreatedAt.Time,
					AvatarType: creatorAvatarType.String,
					AvatarURL:  creatorAvatarURL.String,
					Decoration: creatorDecoration.String,
					ColorHue:   creatorColorHue,
				}
			}
			submissions = append(submissions, &s)
			byID[s.ID] = &s
		})
	if err != nil || len(submissions) == 0 {
		return submissions, err
	}

	ids := make([]any, len(submissions))
	for i, s := range submissions {
		ids[i] = s.ID
	}
	in := "(" + placeholders(len(ids)) + ")"

	var submissionID string
	var comment models.Comment
	commentsByID := map[string]*models.Comment{}
	err = queryEach(repo, ctx, `
		SELECT c.submission_id, c.id, c.text, c.created_at, `+activityUserColumns("u")+`
		FROM comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.submission_id IN `+in+`
		ORDER BY c.created_at ASC, c.id ASC`,
		ids,
		append([]any{&submissionID, &comment.ID, &comment.Text, &comment.CreatedAt}, activityUserDest(&comment.User)...),
		func() {
			c := comment
			c.Reactions, c.Counts = []models.Reaction{}, []models.ReactionCount{}
			s := byID[submissionID]
			s.Comments = append(s.Comments, c)
		})
	if err != nil {
		return nil, err
	}
	// Pointers into Comments are only stable once every append is done
	for _, s := range submissions {
		for i := range s.Comments {
			commentsByID[s.Comments[i].ID] = &s.Comments[i]
		}
	}

	// comments.id is an INTEGER and reactions.content_id TEXT, so the CAST lets the lookup use idx_reactions_content_id
	commentIDs := `SELECT CAST(c.id AS TEXT) FROM comments c WHERE c.submission_id IN ` + in
	var contentType, contentID string
	var reaction models.Reaction
	err = queryEach(repo, ctx, `
		SELECT r.content_type, r.content_id, r.id, r.reaction_id, r.created_at, `+activityUserColumns("u")+`
		FROM reactions r
		JOIN users u ON u.id = r.user_id
		WHERE (r.content_type = 'submission' AND r.content_id IN `+in+`)
			OR (r.content_type = 'comment' AND r.content_id IN (`+commentIDs+`))
		ORDER BY r.created_at ASC`,
		slices.Concat(ids, ids),
		append([]any{&contentType, &contentID, &reaction.ID, &reaction.ReactionID, &reaction.CreatedAt}, activityUserDest(&reaction.User)...),
		func() {
			if contentType == "submission" {
				s := byID[contentID]
				s.Reactions = append(s.Reactions, reaction)
				s.Counts = addCount(s.Counts, reaction.ReactionID)
			} else if c := commentsByID[contentID]; c != nil {
				c.Reactions = append(c.Reactions, reaction)
				c.Counts = addCount(c.Counts, reaction.ReactionID)
			}
		})
	if err != nil {
		return nil, err
	}
	for _, s := range submissions {
		sortCounts(s.Counts)
		for i := range s.Comments {
			sortCounts(s.Comments[i].Counts)
		}
	}

	// Extras: a doodle still shows without them
	if err := AttachAIReviews(repo, ctx, submissions); err != nil {
		log.Printf("Error fetching AI reviews: %v", err)
	}
	if err := AttachSubmissionFlags(repo, ctx, submissions); err != nil {
		log.Printf("Error fetching submission flags: %v", err)
	}
	return submissions, nil
}

func addCount(counts []models.ReactionCount, reactionID string) []models.ReactionCount {
	for i := range counts {
		if counts[i].ReactionID == reactionID {
			counts[i].Count++
			return counts
		}
	}
	return append(counts, models.ReactionCount{ReactionID: reactionID, Count: 1})
}

// sortCounts puts the most-picked reactions first, like the reaction count queries do
func sortCounts(counts []models.ReactionCount) {
	slices.SortStableFunc(counts, func(a, b models.ReactionCount) int {
		if a.Count != b.Count {
			return b.Count - a.Count
		}
		return strings.Compare(a.ReactionID, b.ReactionID)
	})
}
