package ai

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/utils"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// Setting keys in the ai_settings table.
const (
	SettingEnabled     = "enabled"
	SettingOpenAIKey   = "openai_api_key"
	SettingOpenAIModel = "openai_model"
)

// Settings is how the judges are set up.
type Settings struct {
	Enabled bool
	APIKey  string
	Model   string
	BaseURL string // OPENAI_BASE_URL, or "" for OpenAI itself
	// KeyFromEnv is true when the key comes from OPENAI_API_KEY, not the admin screen
	KeyFromEnv bool
}

// Ready reports whether new doodles get judged.
func (s Settings) Ready() bool {
	return s.Enabled && s.APIKey != ""
}

// LoadSettings reads the saved settings. A key saved in the admin screen wins over
// OPENAI_API_KEY.
func LoadSettings(repo *sql.DB, ctx context.Context, cfg *config.Config) (Settings, error) {
	saved, err := queries.GetAISettings(repo, ctx)
	if err != nil {
		return Settings{}, err
	}
	s := Settings{
		Enabled: saved[SettingEnabled] == "true",
		APIKey:  saved[SettingOpenAIKey],
		Model:   saved[SettingOpenAIModel],
	}
	if s.APIKey == "" && cfg.OpenAIAPIKey != "" {
		s.APIKey = cfg.OpenAIAPIKey
		s.KeyFromEnv = true
	}
	if s.Model == "" {
		s.Model = DefaultOpenAIModel
	}
	s.BaseURL = cfg.OpenAIBaseURL
	return s, nil
}

// NewProvider builds the model client for the settings. Tests swap it for a fake.
var NewProvider = func(s Settings) Provider {
	client := NewOpenAI(s.APIKey, s.Model)
	if s.BaseURL != "" {
		client.BaseURL = strings.TrimRight(s.BaseURL, "/")
	}
	return client
}

// How long a review may take before it's given up on
const reviewTimeout = 90 * time.Second

// Run asks the provider for a verdict, without saving anything (admin previews use this).
// It rolls the rare love-or-hate swing first, so the judge knows how it feels.
func Run(ctx context.Context, provider Provider, req Request) (Verdict, error) {
	req.Swing = rollSwing()
	raw, err := provider.Judge(ctx, req)
	if err != nil {
		return Verdict{}, err
	}
	return ParseVerdict(raw, req.Personality, req.Swing)
}

// RunMeta says why a judge is being run, for the AI log.
type RunMeta struct {
	Kind         queries.AIRunKind
	BatchID      string // Groups judges run together in the testing ground
	SubmissionID string // "" for a custom testing-ground drawing
	UserID       string // The artist for a real doodle, else the admin running it
	ImageData    string // A custom drawing, as a data: URL, so the log can show it
}

// RunAndLog asks for a verdict and writes the attempt to the AI log, whether it worked or
// not. Nothing is saved to the doodle itself. Returns how long the judge took.
func RunAndLog(ctx context.Context, repo *sql.DB, provider Provider, req Request, meta RunMeta) (Verdict, time.Duration, error) {
	start := time.Now()
	verdict, err := Run(ctx, provider, req)
	took := time.Since(start)

	p := req.Personality
	run := queries.AIRun{
		Kind:            meta.Kind,
		BatchID:         meta.BatchID,
		PersonalityID:   p.ID,
		JudgeName:       p.Name,
		JudgeAvatarURL:  p.AvatarURL,
		JudgeDecoration: p.Decoration,
		SystemPrompt:    p.SystemPrompt,
		Prompt:          req.Prompt,
		ImageData:       meta.ImageData,
		Model:           provider.Model(),
		DurationMS:      took.Milliseconds(),
	}
	if meta.SubmissionID != "" {
		run.SubmissionID = &meta.SubmissionID
	}
	if meta.UserID != "" {
		run.User = &models.User{ID: meta.UserID}
	}
	if err != nil {
		run.Status = "failed"
		run.Error = err.Error()
	} else {
		run.Status = "done"
		run.Score = &verdict.Score
		run.Criteria = verdict.Criteria
		run.Comment = verdict.Comment
		run.Metadata = queries.AIRunMetadata{
			Seen: verdict.Seen, Effort: verdict.Effort, EffortPenalty: verdict.EffortPenalty,
			Prompt: verdict.Prompt, PromptMissing: verdict.PromptMissing, PromptBonus: verdict.PromptBonus,
			Swing: verdict.Swing.Kind, SwingPoints: verdict.Swing.Points,
		}
		if verdict.Swing.Kind != SwingNone {
			log.Printf("AI judge: %s got a %s swing of %+.1f on %q", p.Name, verdict.Swing.Kind, verdict.Swing.Points, req.Prompt)
		}
	}
	// A fresh context: ctx may be why it failed, and the attempt is still worth logging
	if _, logErr := queries.LogAIRun(repo, context.Background(), run); logErr != nil {
		log.Printf("AI judge: couldn't log a run of %s: %v", p.Name, logErr)
	}
	return verdict, took, err
}

// Review has the personality judge a doodle and saves the result, replacing any earlier
// review. While it runs, the review shows as pending; if it fails, players see nothing.
func Review(ctx context.Context, repo *sql.DB, provider Provider, submissionID string, req Request, meta RunMeta) (Verdict, error) {
	if err := queries.StartAIReview(repo, ctx, submissionID, req.Personality); err != nil {
		return Verdict{}, err
	}
	return finishReview(ctx, repo, provider, submissionID, req, meta)
}

// finishReview runs a review that's already marked pending and saves how it went.
func finishReview(ctx context.Context, repo *sql.DB, provider Provider, submissionID string, req Request, meta RunMeta) (Verdict, error) {
	meta.SubmissionID = submissionID
	verdict, _, err := RunAndLog(ctx, repo, provider, req, meta)
	if err != nil {
		// Saved with a fresh context: ctx may be why it failed
		if saveErr := queries.FailAIReview(repo, context.Background(), submissionID, err.Error()); saveErr != nil {
			log.Printf("AI judge: couldn't record failure for %s: %v", submissionID, saveErr)
		}
		return Verdict{}, err
	}

	err = queries.FinishAIReview(repo, ctx, submissionID, verdict.Score, verdict.Criteria, verdict.Comment, provider.Model())
	return verdict, err
}

// NewSubmissionReview is a just-drawn doodle's review, already marked pending.
type NewSubmissionReview struct {
	repo         *sql.DB
	provider     Provider
	submissionID string
	artistID     string
	req          Request
	// OnDone, if set, runs after the verdict is saved, e.g. to tell the artist
	OnDone func(artistID, submissionID string, judge models.AIPersonality, verdict Verdict)
}

// StartNewSubmissionReview marks a just-drawn doodle as being judged, if the judges are
// switched on, so the app knows to wait for the comment. It returns nil (and records
// nothing) when judging is off or no judge is switched on: that doodle never shows any AI
// UI. Call Run on the result, in the background, with the doodle's image.
func StartNewSubmissionReview(ctx context.Context, repo *sql.DB, cfg *config.Config, submissionID string) (*NewSubmissionReview, error) {
	settings, err := LoadSettings(repo, ctx, cfg)
	if err != nil || !settings.Ready() {
		return nil, err
	}

	sub, err := queries.GetSubmissionForAIReview(repo, ctx, submissionID)
	if err != nil {
		return nil, err
	}
	personality, err := PickPersonalityForDay(repo, ctx, cfg, sub.Day)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := queries.StartAIReview(repo, ctx, submissionID, personality); err != nil {
		return nil, err
	}
	return &NewSubmissionReview{
		repo:         repo,
		provider:     NewProvider(settings),
		submissionID: submissionID,
		artistID:     sub.UserID,
		req:          Request{Personality: personality, Prompt: sub.Prompt},
	}, nil
}

// Run judges the doodle and saves the verdict (or the failure).
func (r *NewSubmissionReview) Run(image []byte) {
	ctx, cancel := context.WithTimeout(context.Background(), reviewTimeout)
	defer cancel()

	req := r.req
	req.Image = image
	meta := RunMeta{Kind: queries.AIRunSubmission, UserID: r.artistID}
	verdict, err := finishReview(ctx, r.repo, r.provider, r.submissionID, req, meta)
	if err != nil {
		log.Printf("AI judge: %s couldn't review %s: %v", req.Personality.Name, r.submissionID, err)
		return
	}
	log.Printf("AI judge: %s reviewed %s", req.Personality.Name, r.submissionID)
	if r.OnDone != nil {
		r.OnDone(r.artistID, r.submissionID, req.Personality, verdict)
	}
}

// PickPersonality returns who judges a doodle drawn now: the judge picked for today, else the
// running event's judge, else the default judge. Returns sql.ErrNoRows when no judge is on.
func PickPersonality(repo *sql.DB, ctx context.Context, cfg *config.Config) (models.AIPersonality, error) {
	return PickPersonalityForDay(repo, ctx, cfg, utils.GetFormattedDate(time.Now()))
}

// PickPersonalityForDay is PickPersonality for a doodle of day, which may not be today.
func PickPersonalityForDay(repo *sql.DB, ctx context.Context, cfg *config.Config, day string) (models.AIPersonality, error) {
	eventID := ""
	event, err := queries.GetActiveEvent(repo, ctx, events.Now(cfg))
	if err == nil {
		eventID = event.ID
	} else if !errors.Is(err, sql.ErrNoRows) {
		return models.AIPersonality{}, err
	}
	return queries.PickAIPersonality(repo, ctx, eventID, day)
}

// LoadSubmissionImage fetches a saved doodle's PNG, for re-judging or previewing one.
// Outside production, doodles aren't uploaded, so it's the placeholder image.
func LoadSubmissionImage(ctx context.Context, cfg *config.Config, userID, submissionID string) ([]byte, error) {
	if cfg.Env != "production" {
		return os.ReadFile("../public/example.png")
	}

	url := utils.GetImageUrl(cfg, utils.GetSubmissionFilename(userID, submissionID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("downloading doodle: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("downloading doodle: status %d", res.StatusCode)
	}
	return io.ReadAll(io.LimitReader(res.Body, 10<<20))
}

// MaxTestJudges is how many judges the testing ground runs at once.
const MaxTestJudges = 6

// TestResult is one judge's answer in the testing ground.
type TestResult struct {
	PersonalityID string
	Name          string
	Verdict       *Verdict
	Error         string
	Took          time.Duration
}

// RunTests has each personality judge the same doodle, side by side, logging each run as a
// test under one batch. Nothing is saved to any doodle or shown to players. Results come
// back in the order the personalities were given.
func RunTests(ctx context.Context, repo *sql.DB, provider Provider, personalities []models.AIPersonality, prompt string, image []byte, meta RunMeta) []TestResult {
	meta.Kind = queries.AIRunTest
	results := make([]TestResult, len(personalities))
	done := make(chan struct{})
	for i, p := range personalities {
		go func() {
			defer func() { done <- struct{}{} }()
			verdict, took, err := RunAndLog(ctx, repo, provider, Request{Personality: p, Prompt: prompt, Image: image}, meta)
			results[i] = TestResult{PersonalityID: p.ID, Name: p.Name, Took: took}
			if err != nil {
				results[i].Error = err.Error()
			} else {
				results[i].Verdict = &verdict
			}
		}()
	}
	for range personalities {
		<-done
	}
	return results
}
