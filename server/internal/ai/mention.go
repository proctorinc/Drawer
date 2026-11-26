package ai

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"errors"
	"fmt"
	"log"
)

// MentionReply is a judge's automatic answer to a comment that @mentions it, claimed and
// waiting to be written by Run.
type MentionReply struct {
	repo     *sql.DB
	cfg      *config.Config
	provider Provider
	sub      queries.SubmissionForAIReview
	review   models.AIReview
	judge    models.AIPersonality
	to       string // Who @mentioned the judge
}

// StartMentionReply claims a doodle's one automatic judge reply when comment, just posted by
// username, @mentions the judge who reviewed the doodle. It returns nil when judging is off,
// the doodle has no review, the comment mentions someone else, or the doodle has already had
// its automatic reply: those mentions wait for an admin on the AI mentions page.
func StartMentionReply(ctx context.Context, repo *sql.DB, cfg *config.Config, submissionID, username, comment string) (*MentionReply, error) {
	reviews, err := queries.GetAIReviews(repo, ctx, []string{submissionID})
	if err != nil {
		return nil, err
	}
	review, ok := reviews[submissionID]
	if !ok || review.Status != models.AIReviewDone || !queries.MentionsJudge(comment, review.Judge.Name) {
		return nil, nil
	}
	settings, err := LoadSettings(repo, ctx, cfg)
	if err != nil || !settings.Ready() {
		return nil, err
	}
	judge, err := queries.GetAIPersonality(repo, ctx, review.Judge.ID)
	if err != nil {
		return nil, fmt.Errorf("loading judge %s: %w", review.Judge.ID, err)
	}
	sub, err := queries.GetSubmissionForAIReview(repo, ctx, submissionID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if claimed, err := queries.ClaimAutoReply(repo, ctx, submissionID); err != nil || !claimed {
		return nil, err
	}
	return &MentionReply{
		repo: repo, cfg: cfg, provider: NewProvider(settings),
		sub: sub, review: review, judge: judge, to: username,
	}, nil
}

// Run has the judge write and post its reply. Should it fail, the claim is given back so the
// next @mention can try.
func (r *MentionReply) Run() {
	ctx, cancel := context.WithTimeout(context.Background(), reviewTimeout)
	defer cancel()
	if err := r.reply(ctx); err != nil {
		log.Printf("AI judge: %s couldn't answer %s on %s: %v", r.judge.Name, r.to, r.sub.ID, err)
		if err := queries.ReleaseAutoReply(r.repo, context.Background(), r.sub.ID); err != nil {
			log.Printf("AI judge: %v", err)
		}
		return
	}
	log.Printf("AI judge: %s answered %s on %s", r.judge.Name, r.to, r.sub.ID)
}

func (r *MentionReply) reply(ctx context.Context) error {
	image, err := LoadSubmissionImage(ctx, r.cfg, r.sub.UserID, r.sub.ID)
	if err != nil {
		return err
	}
	thread, err := queries.GetCommentThread(r.repo, ctx, r.sub.ID)
	if err != nil {
		return err
	}
	drafts, err := Replies(ctx, r.provider, ReplyRequest{
		Personality: r.judge, Prompt: r.sub.Prompt, Day: r.sub.Day, Artist: r.sub.Artist, Image: image,
		Review: r.review, Thread: thread, To: r.to,
	})
	if err != nil {
		return err
	}
	return queries.PostAutoReply(r.repo, ctx, r.sub.ID, r.judge, drafts[0].Text)
}
