package duel

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/ai"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"encoding/json"
	"errors"
	"time"
)

// DrawSeconds is how long the drawer gets once they see their prompt.
const DrawSeconds = 60

// drawGrace covers the upload after the clock runs out.
const drawGrace = 20 * time.Second

// Waiting on someone: a reminder goes out after RemindAfter, and the duel expires after
// ExpireAfter. A waiting player can nudge once per NudgeEvery.
const (
	RemindAfter = 20 * time.Hour
	ExpireAfter = 72 * time.Hour
	NudgeEvery  = 4 * time.Hour
)

// hereWindow is how recently a player must have looked to count as here right now. The
// app polls a few times that often while a duel is open.
const hereWindow = 15 * time.Second

// Phases of a duel, from the duel's point of view
const (
	PhaseDraw  = "draw"
	PhaseGuess = "guess"
)

// Current is the round being played and what it's waiting on (PhaseDraw or PhaseGuess).
// For a duel that's over, round is nil and phase is its status.
func Current(d models.Duel) (*models.DuelRound, string) {
	if d.Status != models.DuelActive {
		return nil, d.Status
	}
	for i := range d.Rounds {
		r := &d.Rounds[i]
		if r.DrawnAt == nil {
			return r, PhaseDraw
		}
		if r.FinishedAt == nil {
			return r, PhaseGuess
		}
	}
	return nil, models.DuelDone
}

// TurnUserID is whose move it is, or "" when the duel is over.
func TurnUserID(d models.Duel) string {
	r, phase := Current(d)
	switch {
	case r == nil:
		return ""
	case phase == PhaseDraw:
		return r.DrawerID
	}
	return r.GuesserID
}

// DrawDeadline is when the drawer's minute (plus upload grace) runs out.
func DrawDeadline(r models.DuelRound) *time.Time {
	if r.DrawStartedAt == nil {
		return nil
	}
	t := r.DrawStartedAt.Add(DrawSeconds * time.Second)
	return &t
}

// Combined is the average of the finished rounds' scores, and whether every round finished.
func Combined(d models.Duel) (*int, bool) {
	total, n := 0, 0
	for _, r := range d.Rounds {
		if r.Score != nil {
			total += *r.Score
			n++
		}
	}
	if n == 0 {
		return nil, false
	}
	avg := (total*10/n + 5) / 10
	return &avg, n == len(d.Rounds)
}

// ---- Host ----

// Host is the AI character who runs the duel, RPG style.
type Host struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	AvatarURL  string `json:"avatarUrl"`
	Decoration string `json:"decoration"`
	// Its character, for writing the summary in its voice; never sent to the app
	prompt string
}

// stockHost runs duels when no AI judge is switched on.
var stockHost = Host{Name: "Sir Doodleton", AvatarURL: "/ai/sir-doodleton.svg"}

// PickHost is today's judge, to host a new duel. "" means the stock host.
func PickHost(ctx context.Context, repo *sql.DB, cfg *config.Config) string {
	p, err := ai.PickPersonality(repo, ctx, cfg)
	if err != nil {
		return ""
	}
	return p.ID
}

// LoadHost is the duel's host, or the stock host if it's gone.
func LoadHost(ctx context.Context, repo *sql.DB, hostID string) Host {
	if hostID == "" {
		return stockHost
	}
	p, err := queries.GetAIPersonality(repo, ctx, hostID)
	if err != nil {
		return stockHost
	}
	return Host{ID: p.ID, Name: p.Name, AvatarURL: p.AvatarURL, Decoration: p.Decoration, prompt: p.SystemPrompt}
}

// LoadTalker is the AI to score and write with, or nil when the judges are off.
func LoadTalker(ctx context.Context, repo *sql.DB, cfg *config.Config) ai.Talker {
	settings, err := ai.LoadSettings(repo, ctx, cfg)
	if err != nil || !settings.Ready() {
		return nil
	}
	talker, _ := ai.NewProvider(settings).(ai.Talker)
	return talker
}

// ---- What a player sees ----

// GuessView is one guess as a player sees it.
type GuessView struct {
	Attempt   int       `json:"attempt"`
	Guess     string    `json:"guess"`
	Score     int       `json:"score"`
	Exact     bool      `json:"exact"`
	Feedback  Feedback  `json:"feedback"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"createdAt"`
}

// RoundView is a round as a player sees it: the prompt stays secret from the guesser until
// the round's over, and from the drawer until their minute starts.
type RoundView struct {
	Number    int    `json:"number"`
	DrawerID  string `json:"drawerId"`
	GuesserID string `json:"guesserId"`
	// "" while it's secret from this player
	Prompt       string   `json:"prompt"`
	Keywords     []string `json:"keywords"`
	KeywordCount int      `json:"keywordCount"`
	// The prompt as a fill-in-the-blank sentence: the small words show, the keywords are blanks
	Template []Segment `json:"template"`
	// Set while (and after) the drawer has their minute
	DrawStartedAt *time.Time `json:"drawStartedAt"`
	DrawDeadline  *time.Time `json:"drawDeadline"`
	Drawn         bool       `json:"drawn"`
	// A data: URL; only sent when the duel is loaded on its own
	Image      string      `json:"image"`
	Guesses    []GuessView `json:"guesses"`
	Score      *int        `json:"score"`
	Finished   bool        `json:"finished"`
	FinishedAt *time.Time  `json:"finishedAt"`
}

// View is a duel as one of its players (or an admin) sees it.
type View struct {
	ID         string      `json:"id"`
	Status     string      `json:"status"`
	Challenger models.User `json:"challenger"`
	Opponent   models.User `json:"opponent"`
	Host       Host        `json:"host"`
	// The round being played (1 or 2), or 0 when it's over
	Round int `json:"round"`
	// draw, guess, done, expired or cancelled
	Phase string `json:"phase"`
	// Whose move it is; "" when it's over
	TurnUserID string `json:"turnUserId"`
	// The other player has the duel open right now
	OtherHereNow bool       `json:"otherHereNow"`
	OtherSeenAt  *time.Time `json:"otherSeenAt"`
	// When the waiting player may nudge again (nil: now)
	NudgeAvailableAt *time.Time `json:"nudgeAvailableAt"`
	// When the duel gives up on whoever's turn it is
	ExpiresAt  *time.Time  `json:"expiresAt"`
	Rounds     []RoundView `json:"rounds"`
	Combined   *int        `json:"combined"`
	Complete   bool        `json:"complete"`
	Summary    string      `json:"summary"`
	CreatedAt  time.Time   `json:"createdAt"`
	UpdatedAt  time.Time   `json:"updatedAt"`
	FinishedAt *time.Time  `json:"finishedAt"`
	// The server's clock, so the app can time the drawer's minute against it
	Now time.Time `json:"now"`
}

// NewView shapes the duel for viewerID. An admin who isn't playing sees everything.
func NewView(d models.Duel, host Host, viewerID string, now time.Time) View {
	r, phase := Current(d)
	v := View{
		ID: d.ID, Status: d.Status, Challenger: d.Challenger, Opponent: d.Opponent, Host: host,
		Phase: phase, TurnUserID: TurnUserID(d), Summary: d.Summary,
		CreatedAt: d.CreatedAt, UpdatedAt: d.UpdatedAt, FinishedAt: d.FinishedAt, Now: now.UTC(),
	}
	if r != nil {
		v.Round = r.Number
		expires := d.UpdatedAt.Add(ExpireAfter)
		v.ExpiresAt = &expires
	}
	v.Combined, v.Complete = Combined(d)

	playing := d.Has(viewerID)
	if playing {
		other := d.Other(viewerID)
		v.OtherSeenAt = d.SeenAt(other.ID)
		v.OtherHereNow = v.OtherSeenAt != nil && now.Sub(*v.OtherSeenAt) < hereWindow
		if d.RemindedAt != nil && now.Sub(*d.RemindedAt) < NudgeEvery {
			next := d.RemindedAt.Add(NudgeEvery)
			v.NudgeAvailableAt = &next
		}
	}

	over := d.Status != models.DuelActive
	for _, round := range d.Rounds {
		finished := round.FinishedAt != nil || over
		isGuesser := playing && viewerID == round.GuesserID
		isDrawer := playing && viewerID == round.DrawerID
		showPrompt := !playing || finished || (isDrawer && round.DrawStartedAt != nil)

		rv := RoundView{
			Number: round.Number, DrawerID: round.DrawerID, GuesserID: round.GuesserID,
			KeywordCount: len(round.Keywords), DrawStartedAt: round.DrawStartedAt, DrawDeadline: DrawDeadline(round),
			Drawn: round.HasImage, Score: round.Score, Finished: round.FinishedAt != nil, FinishedAt: round.FinishedAt,
			Guesses: []GuessView{}, Keywords: []string{}, Template: Template(round.Prompt, round.Keywords),
		}
		if showPrompt {
			rv.Prompt, rv.Keywords = round.Prompt, round.Keywords
		}
		if round.HasImage {
			rv.Image = round.Image
		}
		for _, g := range round.Guesses {
			var fb Feedback
			_ = json.Unmarshal(g.Feedback, &fb)
			if isGuesser && !finished {
				fb = fb.ForGuesser()
			}
			rv.Guesses = append(rv.Guesses, GuessView{
				Attempt: g.Attempt, Guess: g.Guess, Score: g.Score, Exact: g.Exact, Feedback: fb, Note: g.Note, CreatedAt: g.CreatedAt,
			})
		}
		v.Rounds = append(v.Rounds, rv)
	}
	return v
}

// ---- Moves ----

// Errors a move can fail with, shown to the player
var (
	ErrNotYourTurn = errors.New("it's not your turn")
	ErrNotStarted  = errors.New("start your minute first")
	ErrDuelOver    = errors.New("this duel is over")
)

// CanDraw checks that it's userID's turn to draw.
func CanDraw(d models.Duel, userID string) (*models.DuelRound, error) {
	if d.Status != models.DuelActive {
		return nil, ErrDuelOver
	}
	r, phase := Current(d)
	if r == nil || phase != PhaseDraw || r.DrawerID != userID {
		return nil, ErrNotYourTurn
	}
	return r, nil
}

// CanGuess checks that it's userID's turn to guess.
func CanGuess(d models.Duel, userID string) (*models.DuelRound, error) {
	if d.Status != models.DuelActive {
		return nil, ErrDuelOver
	}
	r, phase := Current(d)
	if r == nil || phase != PhaseGuess || r.GuesserID != userID {
		return nil, ErrNotYourTurn
	}
	return r, nil
}

// LateDrawing reports whether a drawing came in well after the minute ran out. It's
// still taken (the app sends what was on the canvas when it reopens), just noted.
func LateDrawing(r models.DuelRound, now time.Time) bool {
	deadline := DrawDeadline(r)
	return deadline != nil && now.After(deadline.Add(drawGrace))
}
