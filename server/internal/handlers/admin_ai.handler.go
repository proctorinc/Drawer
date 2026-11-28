package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/ai"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AdminAISettings is the AI judges' setup as admins see it. The key itself never leaves
// the server; admins see whether one is set and its last few characters.
type AdminAISettings struct {
	Enabled      bool   `json:"enabled"`
	Model        string `json:"model"`
	DefaultModel string `json:"defaultModel"`
	HasAPIKey    bool   `json:"hasApiKey"`
	APIKeyHint   string `json:"apiKeyHint"`
	KeyFromEnv   bool   `json:"keyFromEnv"`
}

func newAdminAISettings(s ai.Settings) AdminAISettings {
	hint := ""
	if len(s.APIKey) > 4 {
		hint = "…" + s.APIKey[len(s.APIKey)-4:]
	}
	return AdminAISettings{
		Enabled:      s.Enabled,
		Model:        s.Model,
		DefaultModel: ai.DefaultOpenAIModel,
		HasAPIKey:    s.APIKey != "",
		APIKeyHint:   hint,
		KeyFromEnv:   s.KeyFromEnv,
	}
}

func HandleAdminGetAISettings(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	settings, err := ai.LoadSettings(appCtx.DB, c.Request.Context(), appCtx.Config)
	if err != nil {
		log.Printf("Error loading AI settings: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load AI settings"))
		return
	}
	c.JSON(http.StatusOK, newAdminAISettings(settings))
}

func HandleAdminUpdateAISettings(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)

	var body struct {
		Enabled *bool   `json:"enabled"`
		Model   *string `json:"model"`
		// A new key; leave it out to keep the current one
		APIKey      *string `json:"apiKey"`
		ClearAPIKey bool    `json:"clearApiKey"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid settings"))
		return
	}

	values := map[string]string{}
	if body.Enabled != nil {
		values[ai.SettingEnabled] = fmt.Sprint(*body.Enabled)
	}
	if body.Model != nil {
		values[ai.SettingOpenAIModel] = strings.TrimSpace(*body.Model)
	}
	if body.ClearAPIKey {
		values[ai.SettingOpenAIKey] = ""
	} else if body.APIKey != nil && strings.TrimSpace(*body.APIKey) != "" {
		values[ai.SettingOpenAIKey] = strings.TrimSpace(*body.APIKey)
	}

	if err := queries.SetAISettings(appCtx.DB, c.Request.Context(), values); err != nil {
		log.Printf("Error saving AI settings: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to save AI settings"))
		return
	}
	HandleAdminGetAISettings(c)
}

func HandleAdminListAIPersonalities(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	list, err := queries.ListAIPersonalities(appCtx.DB, c.Request.Context())
	if err != nil {
		log.Printf("Error listing AI personalities: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to list AI judges"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"personalities": list})
}

func HandleAdminCreateAIPersonality(c *gin.Context) {
	savePersonality(c, "")
}

func HandleAdminUpdateAIPersonality(c *gin.Context) {
	savePersonality(c, c.Param("id"))
}

func savePersonality(c *gin.Context, id string) {
	appCtx := requestContext.GetCtx(c)

	p, ok := bindPersonality(c)
	if !ok {
		return
	}
	p.ID = id

	taken, err := queries.IsAIPersonalitySlugTaken(appCtx.DB, c.Request.Context(), p.Slug, id)
	if err != nil {
		log.Printf("Error checking AI personality slug: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to save AI judge"))
		return
	}
	if taken {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Another judge already uses the slug "+p.Slug))
		return
	}

	saved, err := queries.SaveAIPersonality(appCtx.DB, c.Request.Context(), p)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("AI judge not found"))
		return
	}
	if err != nil {
		log.Printf("Error saving AI personality %s: %v", p.Slug, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to save AI judge"))
		return
	}

	status := http.StatusOK
	if id == "" {
		status = http.StatusCreated
	}
	c.JSON(status, saved)
}

func HandleAdminDeleteAIPersonality(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	err := queries.DeleteAIPersonality(appCtx.DB, c.Request.Context(), c.Param("id"))
	switch {
	case errors.Is(err, queries.ErrAIPersonalityInUse):
		c.AbortWithStatusJSON(http.StatusConflict, Error("This judge has already reviewed doodles. Switch it off instead."))
	case errors.Is(err, sql.ErrNoRows):
		c.AbortWithStatusJSON(http.StatusNotFound, Error("AI judge not found"))
	case err != nil:
		log.Printf("Error deleting AI personality: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to delete AI judge"))
	default:
		c.Status(http.StatusNoContent)
	}
}

// PersonalityInput is a personality as the admin screen sends it.
type PersonalityInput struct {
	ID           string  `json:"id"` // Only read by the testing ground, to log which judge ran
	Slug         string  `json:"slug"`
	Name         string  `json:"name"`
	Bio          string  `json:"bio"`
	SystemPrompt string  `json:"systemPrompt"`
	AvatarURL    string  `json:"avatarUrl"`
	Decoration   string  `json:"decoration"`
	IsDefault    bool    `json:"isDefault"`
	EventID      *string `json:"eventId"`
	Enabled      bool    `json:"enabled"`
	// Criteria measure faults, so the better the doodle, the lower the score
	ScoresBackwards bool `json:"scoresBackwards"`
	Criteria        []struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		ImageURL    string `json:"imageUrl"`
	} `json:"criteria"`
}

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

// ToPersonality checks the input and turns it into a personality (without an ID).
func (in PersonalityInput) ToPersonality() (models.AIPersonality, error) {
	p := models.AIPersonality{
		Name:            strings.TrimSpace(in.Name),
		Bio:             strings.TrimSpace(in.Bio),
		SystemPrompt:    strings.TrimSpace(in.SystemPrompt),
		AvatarURL:       strings.TrimSpace(in.AvatarURL),
		Decoration:      strings.TrimSpace(in.Decoration),
		IsDefault:       in.IsDefault,
		Enabled:         in.Enabled,
		ScoresBackwards: in.ScoresBackwards,
		Criteria:        []models.AICriterion{},
	}
	if in.EventID != nil && *in.EventID != "" {
		p.EventID = in.EventID
	}

	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		slug = p.Name
	}
	p.Slug = strings.Trim(nonSlugChars.ReplaceAllString(strings.ToLower(slug), "-"), "-")

	switch {
	case p.Name == "" || len(p.Name) > 40:
		return p, errors.New("a judge needs a name of up to 40 characters")
	case p.Slug == "":
		return p, errors.New("a judge needs a slug")
	case p.SystemPrompt == "":
		return p, errors.New("a judge needs a personality prompt")
	case len(p.SystemPrompt) > 4000:
		return p, errors.New("the personality prompt can be at most 4000 characters")
	case len(p.Bio) > 300:
		return p, errors.New("the about text can be at most 300 characters")
	case len(in.Criteria) > models.MaxAICriteria:
		return p, fmt.Errorf("a judge can score at most %d criteria", models.MaxAICriteria)
	case p.IsDefault && p.EventID != nil:
		return p, errors.New("the default judge can't belong to an event")
	}

	for _, c := range in.Criteria {
		criterion := models.AICriterion{
			ID:          strings.TrimSpace(c.ID),
			Name:        strings.TrimSpace(c.Name),
			Description: strings.TrimSpace(c.Description),
			ImageURL:    strings.TrimSpace(c.ImageURL),
		}
		if criterion.Name == "" || len(criterion.Name) > 30 {
			return p, errors.New("each criterion needs a name of up to 30 characters")
		}
		p.Criteria = append(p.Criteria, criterion)
	}
	return p, nil
}

func bindPersonality(c *gin.Context) (models.AIPersonality, bool) {
	var input PersonalityInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid AI judge: "+err.Error()))
		return models.AIPersonality{}, false
	}
	p, err := input.ToPersonality()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error(err.Error()))
		return models.AIPersonality{}, false
	}
	return p, true
}

// AdminAIVerdict is a judge's answer, shown to admins straight away.
type AdminAIVerdict struct {
	Score    float64                   `json:"score"`
	Criteria []models.AICriterionScore `json:"criteria"`
	Comment  string                    `json:"comment"`
	Model    string                    `json:"model"`
	// What the judge thought it saw, and the hidden penalty for little effort (already in Score)
	Seen          string  `json:"seen"`
	Idea          string  `json:"idea"`    // What it thought the artist was going for
	Notable       string  `json:"notable"` // What it passed on for the comment to joke about
	Effort        string  `json:"effort"`
	EffortPenalty float64 `json:"effortPenalty"`
	// How well it follows the prompt, what it's missing, and the bonus added to every score
	Prompt        string  `json:"prompt"`
	PromptMissing string  `json:"promptMissing"`
	PromptBonus   float64 `json:"promptBonus"`
	// The rare love or hate swing added to every score, usually none
	Swing ai.Swing `json:"swing"`
}

func newAdminAIVerdict(v ai.Verdict, model string) AdminAIVerdict {
	criteria := v.Criteria
	if criteria == nil {
		criteria = []models.AICriterionScore{}
	}
	return AdminAIVerdict{
		Score: v.Score, Criteria: criteria, Comment: v.Comment, Model: model,
		Seen: v.Seen, Idea: v.Idea, Notable: v.Notable, Effort: v.Effort, EffortPenalty: v.EffortPenalty,
		Prompt: v.Prompt, PromptMissing: v.PromptMissing, PromptBonus: v.PromptBonus, Swing: v.Swing,
	}
}

// loadKeyedSettings loads the settings, responding and returning false when there's no key.
// Admins can test and re-run with the judges switched off; they just need a key.
func loadKeyedSettings(c *gin.Context) (ai.Settings, bool) {
	appCtx := requestContext.GetCtx(c)
	settings, err := ai.LoadSettings(appCtx.DB, c.Request.Context(), appCtx.Config)
	if err != nil {
		log.Printf("Error loading AI settings: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load AI settings"))
		return settings, false
	}
	if settings.APIKey == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Add an OpenAI API key first"))
		return settings, false
	}
	return settings, true
}

// loadJudging gets what any manual judging needs: ready settings and the doodle. It
// responds and returns false on failure.
func loadJudging(c *gin.Context, submissionID string) (ai.Settings, queries.SubmissionForAIReview, []byte, bool) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()

	settings, ok := loadKeyedSettings(c)
	if !ok {
		return settings, queries.SubmissionForAIReview{}, nil, false
	}

	sub, err := queries.GetSubmissionForAIReview(appCtx.DB, ctx, submissionID)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Doodle not found"))
		return settings, sub, nil, false
	}
	if err != nil {
		log.Printf("Error loading submission %s for AI review: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load doodle"))
		return settings, sub, nil, false
	}

	image, err := ai.LoadSubmissionImage(ctx, appCtx.Config, sub.UserID, sub.ID)
	if err != nil {
		log.Printf("Error loading image of %s for AI review: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load the doodle's image"))
		return settings, sub, nil, false
	}
	return settings, sub, image, true
}

// maxTestImageBytes caps a custom testing-ground drawing.
const maxTestImageBytes = 2 << 20

// AdminAITestResult is one judge's answer in the testing ground.
type AdminAITestResult struct {
	PersonalityID string          `json:"personalityId"`
	Name          string          `json:"name"`
	Verdict       *AdminAIVerdict `json:"verdict"` // Unset when it failed
	Error         string          `json:"error"`
	DurationMS    int64           `json:"durationMs"`
	Run           queries.AIRun   `json:"run"` // The AI log entry it wrote, which the log page shows the same way
}

// HandleAdminTestAI is the testing ground: one or more judges, unsaved edits and all, review
// the same doodle side by side. The doodle is a past one (submissionId) or a custom prompt
// and drawing (prompt + imageData, a data:image/png;base64 URL). Every run is logged as a
// test; nothing is saved to any doodle or shown to players until an admin applies a run.
func HandleAdminTestAI(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	admin := middleware.GetUser(c)

	var body struct {
		SubmissionID  string             `json:"submissionId"`
		Prompt        string             `json:"prompt"`
		ImageData     string             `json:"imageData"`
		Personalities []PersonalityInput `json:"personalities"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid test: "+err.Error()))
		return
	}
	if len(body.Personalities) == 0 || len(body.Personalities) > ai.MaxTestJudges {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error(fmt.Sprintf("Pick 1 to %d judges", ai.MaxTestJudges)))
		return
	}

	personalities := make([]models.AIPersonality, 0, len(body.Personalities))
	for _, in := range body.Personalities {
		p, err := in.ToPersonality()
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, Error(fmt.Sprintf("%s: %v", in.Name, err)))
			return
		}
		p.ID = in.ID
		// Unsaved criteria need ids the model can answer with
		for i := range p.Criteria {
			if p.Criteria[i].ID == "" {
				p.Criteria[i].ID = fmt.Sprintf("criterion-%d", i+1)
			}
		}
		personalities = append(personalities, p)
	}

	meta := ai.RunMeta{BatchID: uuid.New().String(), UserID: admin.ID}
	var (
		settings      ai.Settings
		prompt        string
		promptContext string
		image         []byte
		ok            bool
	)
	if body.SubmissionID != "" {
		var sub queries.SubmissionForAIReview
		settings, sub, image, ok = loadJudging(c, body.SubmissionID)
		if !ok {
			return
		}
		prompt, promptContext = sub.Prompt, sub.PromptContext
		meta.SubmissionID = sub.ID
	} else {
		prompt = strings.TrimSpace(body.Prompt)
		if prompt == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, Error("Give the drawing a prompt"))
			return
		}
		var err error
		image, err = decodePNGDataURL(body.ImageData)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, Error(err.Error()))
			return
		}
		meta.ImageData = body.ImageData
		if settings, ok = loadKeyedSettings(c); !ok {
			return
		}
	}

	provider := ai.NewProvider(settings)
	results := ai.RunTests(ctx, appCtx.DB, provider, personalities, prompt, promptContext, image, meta)

	response := make([]AdminAITestResult, 0, len(results))
	for _, r := range results {
		out := AdminAITestResult{PersonalityID: r.PersonalityID, Name: r.Name, Error: r.Error, DurationMS: r.Took.Milliseconds(), Run: r.Run}
		if r.Verdict != nil {
			v := newAdminAIVerdict(*r.Verdict, provider.Model())
			out.Verdict = &v
		}
		response = append(response, out)
	}
	c.JSON(http.StatusOK, gin.H{"batchId": meta.BatchID, "prompt": prompt, "results": response})
}

func decodePNGDataURL(dataURL string) ([]byte, error) {
	const prefix = "data:image/png;base64,"
	if !strings.HasPrefix(dataURL, prefix) {
		return nil, errors.New("Draw something first")
	}
	if len(dataURL) > maxTestImageBytes*4/3+len(prefix) {
		return nil, errors.New("That drawing is too big")
	}
	image, err := base64.StdEncoding.DecodeString(dataURL[len(prefix):])
	if err != nil {
		return nil, errors.New("Couldn't read the drawing")
	}
	return image, nil
}

// HandleAdminListAIRuns is the AI log: the newest runs of every kind, and counts of all of them.
func HandleAdminListAIRuns(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()

	runs, err := queries.ListAIRuns(appCtx.DB, ctx, 500)
	if err != nil {
		log.Printf("Error listing AI runs: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load the AI log"))
		return
	}
	stats, err := queries.GetAIRunStats(appCtx.DB, ctx)
	if err != nil {
		log.Printf("Error counting AI runs: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load the AI log"))
		return
	}
	for i := range runs {
		switch {
		case runs[i].ImageData != "":
			runs[i].ImageURL = runs[i].ImageData
		case runs[i].SubmissionID != nil && runs[i].ArtistID != "":
			runs[i].ImageURL = utils.GetImageUrl(appCtx.Config, utils.GetSubmissionFilename(runs[i].ArtistID, *runs[i].SubmissionID))
		}
	}
	c.JSON(http.StatusOK, gin.H{"runs": runs, "stats": stats})
}

// AdminAIRerun is a fresh run on a doodle, logged but not yet applied.
type AdminAIRerun struct {
	Verdict AdminAIVerdict `json:"verdict"`
	Run     queries.AIRun  `json:"run"`
}

// HandleAdminRerunAIReview has a judge look at a doodle again and logs it as a re-run. Players
// see nothing new until an admin applies the run (HandleAdminApplyAIRun). The body may pick the
// judge; otherwise it's whoever reviewed the doodle, or whoever would judge it today.
func HandleAdminRerunAIReview(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	submissionID := c.Param("submissionId")

	var body struct {
		PersonalityID string `json:"personalityId"`
	}
	_ = c.ShouldBindJSON(&body)

	settings, sub, image, ok := loadJudging(c, submissionID)
	if !ok {
		return
	}

	judgeID := body.PersonalityID
	if judgeID == "" {
		id, err := queries.GetAIReviewJudgeID(appCtx.DB, ctx, submissionID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			log.Printf("Error loading the judge of %s: %v", submissionID, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to pick an AI judge"))
			return
		}
		judgeID = id
	}
	var (
		p   models.AIPersonality
		err error
	)
	if judgeID != "" {
		p, err = queries.GetAIPersonality(appCtx.DB, ctx, judgeID)
	} else {
		p, err = ai.PickPersonalityForDay(appCtx.DB, ctx, appCtx.Config, sub.Day)
	}
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("No AI judge to do it"))
		return
	}
	if err != nil {
		log.Printf("Error picking AI judge: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to pick an AI judge"))
		return
	}

	// A re-run hears the artist's promise to the Grinch, like the first run did
	pledge, err := ai.PledgeFor(appCtx.DB, ctx, p, sub.UserID, sub.Day)
	if err != nil {
		log.Printf("Error loading the artist's judge pledge: %v", err)
	}
	provider := ai.NewProvider(settings)
	meta := ai.RunMeta{Kind: queries.AIRunRerun, SubmissionID: submissionID, UserID: middleware.GetUser(c).ID}
	verdict, run, err := ai.RunAndLog(ctx, appCtx.DB, provider, ai.Request{Personality: p, Prompt: sub.Prompt, PromptContext: sub.PromptContext, Image: image, Pledge: pledge, Day: sub.Day}, meta)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadGateway, Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, AdminAIRerun{Verdict: newAdminAIVerdict(verdict, provider.Model()), Run: run})
}

// HandleAdminApplyAIRun makes a logged re-run or testing-ground run its doodle's review, the
// one players see, replacing the old one (which stays in the AI log).
func HandleAdminApplyAIRun(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	err := queries.ApplyAIRun(appCtx.DB, c.Request.Context(), c.Param("id"))
	switch {
	case errors.Is(err, sql.ErrNoRows):
		c.AbortWithStatusJSON(http.StatusNotFound, Error("No such AI run"))
	case errors.Is(err, queries.ErrAIRunNoDoodle), errors.Is(err, queries.ErrAIRunFailed), errors.Is(err, queries.ErrAIRunJudgeGone):
		c.AbortWithStatusJSON(http.StatusBadRequest, Error(err.Error()))
	case err != nil:
		log.Printf("Error applying AI run %s: %v", c.Param("id"), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to apply the review"))
	default:
		c.Status(http.StatusNoContent)
	}
}

func HandleAdminListAIReviews(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	list, err := queries.ListRecentAIReviews(appCtx.DB, c.Request.Context(), 100)
	if err != nil {
		log.Printf("Error listing AI reviews: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to list AI reviews"))
		return
	}
	for i := range list {
		list[i].ImageURL = utils.GetImageUrl(appCtx.Config, utils.GetSubmissionFilename(list[i].Artist.ID, list[i].SubmissionID))
	}
	c.JSON(http.StatusOK, gin.H{"reviews": list})
}

// TodaysJudge is who will score a doodle drawn now, as players see it before drawing.
type TodaysJudge struct {
	Judge    models.AIJudge       `json:"judge"`
	Criteria []models.AICriterion `json:"criteria"`
	// Only for a judge that scores backwards: whether you joined him (true), refused (false),
	// or haven't answered (null)
	Pledge *bool `json:"pledge"`
}

// HandleGetTodaysJudge says who will judge a doodle drawn now: the running event's judge or
// the default one. 204 when judging is off or no judge is switched on, so the app shows nothing.
func HandleGetTodaysJudge(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()

	settings, err := ai.LoadSettings(appCtx.DB, ctx, appCtx.Config)
	if err != nil {
		log.Printf("Error loading AI settings: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load today's judge"))
		return
	}
	if !settings.Ready() {
		c.Status(http.StatusNoContent)
		return
	}
	p, err := ai.PickPersonality(appCtx.DB, ctx, appCtx.Config)
	if errors.Is(err, sql.ErrNoRows) {
		c.Status(http.StatusNoContent)
		return
	}
	if err != nil {
		log.Printf("Error picking today's AI judge: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load today's judge"))
		return
	}
	c.JSON(http.StatusOK, TodaysJudge{
		Judge:    p.Judge(),
		Criteria: p.Criteria,
		Pledge:   todaysPledge(c, p),
	})
}

// HandleListAIJudgeNames lists every judge's name, so the app can tell a judge's @handle from a
// player's: only the judge who reviewed a doodle is highlighted when @ed in its comments.
func HandleListAIJudgeNames(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	names, err := queries.ListAIJudgeNames(appCtx.DB, c.Request.Context())
	if err != nil {
		log.Printf("HandleListAIJudgeNames: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load the judges"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"names": names})
}

// TodaysJudgeIntro is the judge asking you for today's doodle, a line at a time.
type TodaysJudgeIntro struct {
	Judge  models.AIJudge `json:"judge"`
	Day    string         `json:"day"`
	Prompt string         `json:"prompt"`
	Lines  []string       `json:"lines"`
	// Only for a judge that scores backwards: your answer to his ask, as in TodaysJudge
	Pledge *bool `json:"pledge"`
	// He's asking whose side you're on and you can still answer (you haven't drawn yet)
	CanPledge bool `json:"canPledge"`
	// Only for a judge that scores backwards: what he remembers of your last visit, which
	// picks the ask you heard (ai.IntroHistory)
	History ai.IntroHistory `json:"history,omitempty"`
	// Only for a judge that scores backwards: what he says after you answer, before you draw
	Replies *ai.IntroReplies `json:"replies,omitempty"`
}

// HandleGetTodaysJudgeIntro has today's judge ask for today's prompt, in character. 204 when
// judging is off, no judge is on, or there's no prompt today.
func HandleGetTodaysJudgeIntro(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()

	settings, err := ai.LoadSettings(appCtx.DB, ctx, appCtx.Config)
	if err != nil {
		log.Printf("Error loading AI settings: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load today's judge"))
		return
	}
	if !settings.Ready() {
		c.Status(http.StatusNoContent)
		return
	}
	p, err := ai.PickPersonality(appCtx.DB, ctx, appCtx.Config)
	if errors.Is(err, sql.ErrNoRows) {
		c.Status(http.StatusNoContent)
		return
	}
	if err != nil {
		log.Printf("Error picking today's AI judge: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load today's judge"))
		return
	}
	today := utils.GetFormattedDate(time.Now())
	prompt, err := queries.GetDailyPrompt(appCtx.DB, ctx, today)
	if errors.Is(err, sql.ErrNoRows) {
		c.Status(http.StatusNoContent)
		return
	}
	if err != nil {
		log.Printf("Error loading today's prompt for the judge intro: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load today's judge"))
		return
	}

	lines := ai.TodaysIntro(ctx, ai.NewProvider(settings), ai.DBIntroStore{DB: appCtx.DB}, p, today, prompt.Prompt)
	var (
		history ai.IntroHistory
		replies *ai.IntroReplies
	)
	if p.ScoresBackwards {
		// He remembers your last visit, and asks you accordingly
		history = lastVisitHistory(c, today)
		lines, replies = ai.StolenIntro(lines, history)
	}
	c.JSON(http.StatusOK, TodaysJudgeIntro{
		Judge:     p.Judge(),
		Day:       today,
		Prompt:    prompt.Prompt,
		History:   history,
		Replies:   replies,
		Lines:     lines,
		Pledge:    todaysPledge(c, p),
		CanPledge: canPledge(c, p),
	})
}

// HandleMarkAIReviewHeard records that you've heard the judge's review of your doodle (its
// dialogue played), so it reads as read everywhere and doesn't play on its own again.
func HandleMarkAIReviewHeard(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	userID := middleware.GetUserID(c)
	if err := queries.MarkAIReviewHeard(appCtx.DB, c.Request.Context(), c.Param("submissionId"), userID); err != nil {
		log.Printf("Error marking AI review heard: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to mark the review heard"))
		return
	}
	c.Status(http.StatusNoContent)
}

// HandleAdminSetPromptJudge hands a day's doodles to one AI judge, or back to the event's or
// default judge when judgeId is empty.
func HandleAdminSetPromptJudge(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	day := c.Param("day")

	var body struct {
		JudgeID string `json:"judgeId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid request: "+err.Error()))
		return
	}

	var judgeID *string
	if body.JudgeID != "" {
		if _, err := queries.GetAIPersonality(appCtx.DB, ctx, body.JudgeID); errors.Is(err, sql.ErrNoRows) {
			c.AbortWithStatusJSON(http.StatusNotFound, Error("No such AI judge"))
			return
		} else if err != nil {
			log.Printf("Error loading AI judge %s: %v", body.JudgeID, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to set the day's judge"))
			return
		}
		judgeID = &body.JudgeID
	}

	err := queries.SetDailyPromptJudge(appCtx.DB, ctx, day, judgeID)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error(day+" has no prompt yet"))
		return
	}
	if err != nil {
		log.Printf("Error setting the judge for %s: %v", day, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to set the day's judge"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"day": day, "judgeId": judgeID})
}

// reviewToFollowUp loads a doodle's finished AI review and its judge, for replies. On failure
// it has already answered the request.
func reviewToFollowUp(c *gin.Context, submissionID string) (models.AIReview, models.AIPersonality, bool) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()

	reviews, err := queries.GetAIReviews(appCtx.DB, ctx, []string{submissionID})
	if err != nil {
		log.Printf("Error loading the AI review of %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load the AI review"))
		return models.AIReview{}, models.AIPersonality{}, false
	}
	review, ok := reviews[submissionID]
	if !ok || review.Status != models.AIReviewDone {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("This doodle has no AI review to follow up on"))
		return review, models.AIPersonality{}, false
	}
	judge, err := queries.GetAIPersonality(appCtx.DB, ctx, review.Judge.ID)
	if err != nil {
		log.Printf("Error loading AI judge %s: %v", review.Judge.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load the AI judge"))
		return review, judge, false
	}
	return review, judge, true
}

// HandleAdminDraftAIReplies has a doodle's judge write a reply to each person it answers in
// the comments, following the admin's direction if given. Nothing is posted: the admin picks
// which drafts to post with HandleAdminPostAIReplies, or drafts again.
func HandleAdminDraftAIReplies(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	submissionID := c.Param("submissionId")

	var body struct {
		Direction string `json:"direction"`
	}
	_ = c.ShouldBindJSON(&body)

	review, judge, ok := reviewToFollowUp(c, submissionID)
	if !ok {
		return
	}
	settings, sub, image, ok := loadJudging(c, submissionID)
	if !ok {
		return
	}
	thread, err := queries.GetCommentThread(appCtx.DB, ctx, submissionID)
	if err != nil {
		log.Printf("Error loading the comments on %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load the comments"))
		return
	}

	drafts, err := ai.Replies(ctx, ai.NewProvider(settings), ai.ReplyRequest{
		Personality: judge, Prompt: sub.Prompt, Day: sub.Day, Artist: sub.Artist, Image: image,
		Review: review, Thread: thread, Direction: body.Direction,
	})
	if err != nil {
		log.Printf("AI judge: %s couldn't draft replies on %s: %v", judge.Name, submissionID, err)
		c.AbortWithStatusJSON(http.StatusBadGateway, Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{"replies": drafts})
}

// maxAIReplyChars caps a reply an admin posts.
const maxAIReplyChars = 500

// HandleAdminPostAIReplies posts the drafted replies an admin approved, in the judge's name.
func HandleAdminPostAIReplies(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	submissionID := c.Param("submissionId")

	var body struct {
		Texts []string `json:"texts"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Texts) == 0 {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Pick at least one reply to post"))
		return
	}
	for i, text := range body.Texts {
		body.Texts[i] = strings.TrimSpace(text)
		if body.Texts[i] == "" || len(body.Texts[i]) > maxAIReplyChars {
			c.AbortWithStatusJSON(http.StatusBadRequest, Error("Each reply needs 1 to 500 characters"))
			return
		}
	}

	_, judge, ok := reviewToFollowUp(c, submissionID)
	if !ok {
		return
	}
	if err := queries.AddAIReplies(appCtx.DB, c.Request.Context(), submissionID, judge, body.Texts); err != nil {
		log.Printf("Error posting AI replies on %s: %v", submissionID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to post the replies"))
		return
	}
	c.Status(http.StatusNoContent)
}

// HandleAdminDeleteAIReply takes a judge's reply out of a doodle's comments.
func HandleAdminDeleteAIReply(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	err := queries.DeleteAIReply(appCtx.DB, c.Request.Context(), c.Param("id"))
	switch {
	case errors.Is(err, sql.ErrNoRows):
		c.AbortWithStatusJSON(http.StatusNotFound, Error("No such reply"))
	case err != nil:
		log.Printf("Error deleting AI reply %s: %v", c.Param("id"), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to delete the reply"))
	default:
		c.Status(http.StatusNoContent)
	}
}
