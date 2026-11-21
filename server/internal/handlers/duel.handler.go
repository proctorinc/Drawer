package handlers

import (
	"context"
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/duel"
	"drawer-service-backend/internal/middleware"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

// maxDuelImageBytes caps a duel drawing's PNG.
const maxDuelImageBytes = 3 << 20

// HandleListDuels is the player's duels, newest first, and who they can challenge.
func HandleListDuels(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	user := middleware.GetUser(c)

	duels, err := queries.ListDuels(appCtx.DB, ctx, user.ID, 50)
	if err != nil {
		log.Printf("HandleListDuels: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load your duels"))
		return
	}
	players, err := queries.ListBetaPlayers(appCtx.DB, ctx)
	if err != nil {
		log.Printf("HandleListDuels: players: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load your duels"))
		return
	}
	opponents := []models.User{}
	for _, p := range players {
		if p.User.ID != user.ID {
			opponents = append(opponents, p.User)
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"duels":       duelViews(ctx, appCtx.DB, duels, user.ID),
		"opponents":   opponents,
		"drawSeconds": duel.DrawSeconds,
		"maxGuesses":  duel.MaxGuesses,
	})
}

func duelViews(ctx context.Context, repo *sql.DB, duels []models.Duel, viewerID string) []duel.View {
	hosts := map[string]duel.Host{}
	now := time.Now()
	views := make([]duel.View, 0, len(duels))
	for _, d := range duels {
		host, ok := hosts[d.HostID]
		if !ok {
			host = duel.LoadHost(ctx, repo, d.HostID)
			hosts[d.HostID] = host
		}
		views = append(views, duel.NewView(d, host, viewerID, now))
	}
	return views
}

// HandleCreateDuel challenges another beta player. The challenger draws first.
func HandleCreateDuel(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	user := middleware.GetUser(c)

	var body struct {
		OpponentID string `json:"opponentId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.OpponentID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Pick someone to duel"))
		return
	}
	if body.OpponentID == user.ID {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("You can't duel yourself"))
		return
	}
	opponent, err := queries.GetUserByID(appCtx.DB, ctx, body.OpponentID)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("No such player"))
		return
	}
	if err != nil {
		log.Printf("HandleCreateDuel: loading opponent: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't start the duel"))
		return
	}
	if ok, err := queries.HasBetaAccess(appCtx.DB, ctx, *opponent); err != nil || !ok {
		c.AbortWithStatusJSON(http.StatusForbidden, Error(opponent.Username+" isn't in the beta yet"))
		return
	}

	// One duel at a time between the same two people, so turns never get mixed up
	mine, err := queries.ListDuels(appCtx.DB, ctx, user.ID, 50)
	if err != nil {
		log.Printf("HandleCreateDuel: listing duels: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't start the duel"))
		return
	}
	for _, d := range mine {
		if d.Status == models.DuelActive && d.Has(opponent.ID) {
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "You already have a duel going with " + opponent.Username, "duelId": d.ID})
			return
		}
	}

	used, err := queries.UsedDuelPrompts(appCtx.DB, ctx, user.ID, opponent.ID)
	if err != nil {
		log.Printf("HandleCreateDuel: used prompts: %v", err)
	}
	first := duel.PickPrompt(used)
	second := duel.PickPrompt(append(used, first.Text))
	id, err := queries.CreateDuel(appCtx.DB, ctx, user.ID, opponent.ID, duel.PickHost(ctx, appCtx.DB, appCtx.Config), [2]queries.NewDuelRound{
		{Prompt: first.Text, Keywords: first.Keywords},
		{Prompt: second.Text, Keywords: second.Keywords},
	})
	if err != nil {
		log.Printf("HandleCreateDuel: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't start the duel"))
		return
	}
	respondDuel(c, id, user.ID, http.StatusCreated)
}

// loadPlayersDuel loads a duel the requester is playing (or, for an admin, any duel).
func loadPlayersDuel(c *gin.Context) (models.Duel, bool) {
	appCtx := requestContext.GetCtx(c)
	user := middleware.GetUser(c)
	d, err := queries.GetDuel(appCtx.DB, c.Request.Context(), c.Param("id"))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !d.Has(user.ID) && user.Role != "admin") {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("No such duel"))
		return d, false
	}
	if err != nil {
		log.Printf("loading duel %s: %v", c.Param("id"), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load the duel"))
		return d, false
	}
	return d, true
}

func respondDuel(c *gin.Context, id, viewerID string, status int) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	d, err := queries.GetDuel(appCtx.DB, ctx, id)
	if err != nil {
		log.Printf("reloading duel %s: %v", id, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load the duel"))
		return
	}
	c.JSON(status, duel.NewView(d, duel.LoadHost(ctx, appCtx.DB, d.HostID), viewerID, time.Now()))
}

// HandleGetDuel is one duel. Looking at it counts as being here, so the other player can
// see you're around; the app polls it while the duel is open.
func HandleGetDuel(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	user := middleware.GetUser(c)
	d, ok := loadPlayersDuel(c)
	if !ok {
		return
	}
	if d.Has(user.ID) && d.Status == models.DuelActive {
		if err := queries.MarkDuelSeen(appCtx.DB, c.Request.Context(), d.ID, user.ID); err != nil {
			log.Printf("HandleGetDuel: marking seen: %v", err)
		}
	}
	c.JSON(http.StatusOK, duel.NewView(d, duel.LoadHost(c.Request.Context(), appCtx.DB, d.HostID), user.ID, time.Now()))
}

func abortMove(c *gin.Context, err error) {
	c.AbortWithStatusJSON(http.StatusConflict, Error(err.Error()))
}

// HandleStartDuelDrawing reveals the drawer's prompt and starts their minute.
func HandleStartDuelDrawing(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	user := middleware.GetUser(c)
	d, ok := loadPlayersDuel(c)
	if !ok {
		return
	}
	r, err := duel.CanDraw(d, user.ID)
	if err != nil {
		abortMove(c, err)
		return
	}
	// Starting twice (a reload) keeps the first start: the clock doesn't reset
	if _, err := queries.StartDuelDrawing(appCtx.DB, c.Request.Context(), d.ID, r.Number); err != nil {
		log.Printf("HandleStartDuelDrawing: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't start your minute"))
		return
	}
	respondDuel(c, d.ID, user.ID, http.StatusOK)
}

// HandleSubmitDuelDrawing saves the drawing and hands it to the guesser.
func HandleSubmitDuelDrawing(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	user := middleware.GetUser(c)
	d, ok := loadPlayersDuel(c)
	if !ok {
		return
	}
	r, err := duel.CanDraw(d, user.ID)
	if err != nil {
		abortMove(c, err)
		return
	}
	if r.DrawStartedAt == nil {
		abortMove(c, duel.ErrNotStarted)
		return
	}

	var body struct {
		Image string `json:"image"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Send a drawing"))
		return
	}
	const prefix = "data:image/png;base64,"
	if !strings.HasPrefix(body.Image, prefix) || len(body.Image) > maxDuelImageBytes*4/3+len(prefix) {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("That drawing couldn't be read"))
		return
	}
	if _, err := base64.StdEncoding.DecodeString(body.Image[len(prefix):]); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("That drawing couldn't be read"))
		return
	}
	if duel.LateDrawing(*r, time.Now()) {
		log.Printf("duel %s: round %d drawing came in after the minute", d.ID, r.Number)
	}

	if err := queries.SaveDuelDrawing(appCtx.DB, ctx, d.ID, r.Number, body.Image); err != nil {
		if errors.Is(err, queries.ErrAlreadyDone) {
			respondDuel(c, d.ID, user.ID, http.StatusOK)
			return
		}
		log.Printf("HandleSubmitDuelDrawing: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't save your drawing"))
		return
	}

	// Tell the guesser it's their go, unless they're watching already
	if fresh, err := queries.GetDuel(appCtx.DB, ctx, d.ID); err == nil {
		notifyUnlessHere(appCtx, fresh, r.GuesserID, "your turn to guess", duel.TurnMessage(fresh, r.GuesserID, user.Username), user)
	}
	respondDuel(c, d.ID, user.ID, http.StatusOK)
}

func notifyUnlessHere(appCtx *requestContext.AppContext, d models.Duel, userID, title, body string, from models.User) {
	if seen := d.SeenAt(userID); seen != nil && time.Since(*seen) < 15*time.Second {
		return
	}
	go duel.Notify(appCtx.DB, appCtx.Config, userID, d.ID, title, body, from)
}

// HandleDuelGuess scores a guess. The round ends at 100% or the last guess; the duel ends
// with the last round.
func HandleDuelGuess(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	user := middleware.GetUser(c)
	d, ok := loadPlayersDuel(c)
	if !ok {
		return
	}
	r, err := duel.CanGuess(d, user.ID)
	if err != nil {
		abortMove(c, err)
		return
	}

	var body struct {
		Guess string `json:"guess"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Type a guess"))
		return
	}
	guess := strings.Join(strings.Fields(body.Guess), " ")
	if guess == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Type a guess"))
		return
	}
	if utf8.RuneCountInString(guess) > duel.MaxGuessChars {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error(fmt.Sprintf("Keep it under %d letters", duel.MaxGuessChars)))
		return
	}

	previous := make([]string, 0, len(r.Guesses))
	for _, g := range r.Guesses {
		previous = append(previous, g.Guess)
	}
	scoreCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	talker := duel.LoadTalker(ctx, appCtx.DB, appCtx.Config)
	result, err := duel.Score(scoreCtx, talker, duel.GuessInput{
		Prompt: r.Prompt, Keywords: r.Keywords, Guess: guess, Previous: previous,
	})
	// With the AI off, word matching is the plan, not a failure
	if err != nil && talker != nil {
		log.Printf("duel %s: AI couldn't score a guess, used word matching: %v", d.ID, err)
	}
	feedback, _ := json.Marshal(result.Feedback)

	attempt := len(r.Guesses) + 1
	finishRound := result.Score >= 100 || attempt >= duel.MaxGuesses
	finishDuel := finishRound && r.Number == len(d.Rounds)
	err = queries.AddDuelGuess(appCtx.DB, ctx, d.ID, r.Number, models.DuelGuess{
		Attempt: attempt, Guess: guess, Score: result.Score, Exact: result.Exact, Feedback: feedback, Note: result.Note,
	}, finishRound, finishDuel)
	if errors.Is(err, queries.ErrAlreadyDone) {
		c.AbortWithStatusJSON(http.StatusConflict, Error("That guess was already in"))
		return
	}
	if err != nil {
		log.Printf("HandleDuelGuess: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't save your guess"))
		return
	}

	if finishRound {
		fresh, err := queries.GetDuel(appCtx.DB, ctx, d.ID)
		if err == nil {
			best := 0
			if fr := fresh.Rounds[r.Number-1]; fr.Score != nil {
				best = *fr.Score
			}
			if finishDuel {
				combined, _ := duel.Combined(fresh)
				total := 0
				if combined != nil {
					total = *combined
				}
				notifyUnlessHere(appCtx, fresh, r.DrawerID, "duel complete!",
					fmt.Sprintf("%s read your drawing at %d%%. Together you scored %d%%. Come see the recap.", user.Username, best, total), user)
				go duel.WriteSummary(appCtx.DB, appCtx.Config, d.ID)
			} else {
				notifyUnlessHere(appCtx, fresh, r.DrawerID, fmt.Sprintf("%s guessed your drawing", user.Username),
					fmt.Sprintf("%d%% of your prompt came through. Now they're drawing one for you.", best), user)
			}
		}
	}
	respondDuel(c, d.ID, user.ID, http.StatusOK)
}

// HandleNudgeDuel lets the waiting player poke whoever's turn it is.
func HandleNudgeDuel(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	user := middleware.GetUser(c)
	d, ok := loadPlayersDuel(c)
	if !ok {
		return
	}
	turnID := duel.TurnUserID(d)
	if turnID == "" || turnID == user.ID || !d.Has(user.ID) {
		abortMove(c, errors.New("there's no one to nudge"))
		return
	}
	claimed, err := queries.ClaimDuelReminder(appCtx.DB, c.Request.Context(), d.ID, duel.NudgeEvery)
	if err != nil {
		log.Printf("HandleNudgeDuel: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't nudge"))
		return
	}
	if !claimed {
		abortMove(c, errors.New("you nudged them recently; give them a bit"))
		return
	}
	go duel.Notify(appCtx.DB, appCtx.Config, turnID, d.ID, user.Username+" is waiting on you",
		duel.TurnMessage(d, turnID, user.Username), user)
	respondDuel(c, d.ID, user.ID, http.StatusOK)
}

// HandleCancelDuel calls the duel off. Rounds already played still show.
func HandleCancelDuel(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	user := middleware.GetUser(c)
	d, ok := loadPlayersDuel(c)
	if !ok {
		return
	}
	if !d.Has(user.ID) {
		abortMove(c, errors.New("only its players can call it off"))
		return
	}
	ended, err := queries.EndDuel(appCtx.DB, c.Request.Context(), d.ID, models.DuelCancelled)
	if err != nil {
		log.Printf("HandleCancelDuel: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't call it off"))
		return
	}
	if ended {
		other := d.Other(user.ID)
		go duel.Notify(appCtx.DB, appCtx.Config, other.ID, d.ID, "duel called off",
			user.Username+" called off your sketch duel.", user)
		go duel.WriteSummary(appCtx.DB, appCtx.Config, d.ID)
	}
	respondDuel(c, d.ID, user.ID, http.StatusOK)
}

// ---- Admin: the beta zone ----

// HandleAdminBeta is who's in the beta and every duel so far.
func HandleAdminBeta(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	user := middleware.GetUser(c)

	players, err := queries.ListBetaPlayers(appCtx.DB, ctx)
	if err != nil {
		log.Printf("HandleAdminBeta: players: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load the beta zone"))
		return
	}
	duels, err := queries.ListDuels(appCtx.DB, ctx, "", 100)
	if err != nil {
		log.Printf("HandleAdminBeta: duels: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load the beta zone"))
		return
	}
	// Seen as an onlooker, so the admin sees every prompt
	onlooker := "admin:" + user.ID
	c.JSON(http.StatusOK, gin.H{
		"players":     players,
		"duels":       duelViews(ctx, appCtx.DB, duels, onlooker),
		"promptCount": duel.PromptCount(),
		"aiReady":     duel.LoadTalker(ctx, appCtx.DB, appCtx.Config) != nil,
	})
}

func HandleAdminAddBetaTester(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	var body struct {
		UserID string `json:"userId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Pick someone"))
		return
	}
	if err := queries.AddBetaTester(appCtx.DB, c.Request.Context(), body.UserID, middleware.GetUser(c).ID); err != nil {
		log.Printf("HandleAdminAddBetaTester: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't add them"))
		return
	}
	c.Status(http.StatusNoContent)
}

func HandleAdminRemoveBetaTester(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	if err := queries.RemoveBetaTester(appCtx.DB, c.Request.Context(), c.Param("id")); err != nil {
		log.Printf("HandleAdminRemoveBetaTester: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't remove them"))
		return
	}
	c.Status(http.StatusNoContent)
}
