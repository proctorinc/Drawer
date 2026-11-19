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
	Criteria     []struct {
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
		Name:         strings.TrimSpace(in.Name),
		Bio:          strings.TrimSpace(in.Bio),
		SystemPrompt: strings.TrimSpace(in.SystemPrompt),
		AvatarURL:    strings.TrimSpace(in.AvatarURL),
		Decoration:   strings.TrimSpace(in.Decoration),
		IsDefault:    in.IsDefault,
		Enabled:      in.Enabled,
		Criteria:     []models.AICriterion{},
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
}

func newAdminAIVerdict(v ai.Verdict, model string) AdminAIVerdict {
	criteria := v.Criteria
	if criteria == nil {
		criteria = []models.AICriterionScore{}
	}
	return AdminAIVerdict{Score: v.Score, Criteria: criteria, Comment: v.Comment, Model: model}
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
}

// HandleAdminTestAI is the testing ground: one or more judges, unsaved edits and all, review
// the same doodle side by side. The doodle is a past one (submissionId) or a custom prompt
// and drawing (prompt + imageData, a data:image/png;base64 URL). Every run is logged as a
// test; nothing is saved to any doodle or shown to players.
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
		settings ai.Settings
		prompt   string
		image    []byte
		ok       bool
	)
	if body.SubmissionID != "" {
		var sub queries.SubmissionForAIReview
		settings, sub, image, ok = loadJudging(c, body.SubmissionID)
		if !ok {
			return
		}
		prompt = sub.Prompt
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
	results := ai.RunTests(ctx, appCtx.DB, provider, personalities, prompt, image, meta)

	response := make([]AdminAITestResult, 0, len(results))
	for _, r := range results {
		out := AdminAITestResult{PersonalityID: r.PersonalityID, Name: r.Name, Error: r.Error, DurationMS: r.Took.Milliseconds()}
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

// HandleAdminRerunAIReview re-judges a doodle and saves it over its old review, shown to
// players. The body may pick the judge; otherwise it's whoever would judge it today.
func HandleAdminRerunAIReview(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	submissionID := c.Param("submissionId")

	var body struct {
		PersonalityID string `json:"personalityId"`
	}
	_ = c.ShouldBindJSON(&body)

	var (
		p   models.AIPersonality
		err error
	)
	if body.PersonalityID != "" {
		p, err = queries.GetAIPersonality(appCtx.DB, ctx, body.PersonalityID)
	} else {
		p, err = ai.PickPersonality(appCtx.DB, ctx, appCtx.Config)
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

	settings, sub, image, ok := loadJudging(c, submissionID)
	if !ok {
		return
	}

	provider := ai.NewProvider(settings)
	meta := ai.RunMeta{Kind: queries.AIRunRerun, UserID: middleware.GetUser(c).ID}
	verdict, err := ai.Review(ctx, appCtx.DB, provider, submissionID, ai.Request{Personality: p, Prompt: sub.Prompt, Image: image}, meta)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadGateway, Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, newAdminAIVerdict(verdict, provider.Model()))
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
		Judge:    models.AIJudge{ID: p.ID, Name: p.Name, Bio: p.Bio, AvatarURL: p.AvatarURL, Decoration: p.Decoration},
		Criteria: p.Criteria,
	})
}
