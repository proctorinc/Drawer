package duel

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/notifications"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"
)

// URL is where a duel opens in the app.
func URL(duelID string) string { return "/draw/beta/duel/" + duelID }

// Notify pushes to a player about the duel, without failing the move that caused it.
func Notify(repo *sql.DB, cfg *config.Config, userID, duelID, title, body string, from models.User) {
	data := models.NotificationData{
		Type:     models.NotificationTypeDuel,
		Title:    title,
		Body:     body,
		URL:      URL(duelID),
		UserID:   from.ID,
		Username: from.Username,
		Action:   "duel",
	}
	if err := notifications.SendNotificationToUser(repo, userID, data, cfg); err != nil {
		log.Printf("duel %s: couldn't notify %s: %v", duelID, userID, err)
	}
}

// ---- Summary ----

const summaryRules = `You host "sketch duels" in a drawing game between friends: a co-op pictionary where each player drew a secret prompt in one minute and the other got three guesses at it. Each guess was scored by how much of the prompt's meaning it caught. They play as a team: their combined score is the average of the two rounds.

Write the closing words you say to both players when it's over, in your own voice, like an RPG character wrapping up a quest:
- 2 or 3 short sentences, at most 50 words in all.
- Call out one specific, funny moment from the rounds below: a wild guess, a near miss, a perfect read, a drawing that clearly confused someone.
- End with the combined score as a percent and a verdict on how in sync they are.
- Keep it PG and kind. Never mention AI, the app or phones. Plain text, no emoji.
Reply only with the JSON you're asked for.`

var summarySchema = map[string]any{
	"type":                 "object",
	"properties":           map[string]any{"summary": map[string]any{"type": "string"}},
	"required":             []string{"summary"},
	"additionalProperties": false,
}

// WriteSummary has the host sum the duel up and saves it. Without an AI it writes a
// stock line, so the end screen never waits forever.
func WriteSummary(repo *sql.DB, cfg *config.Config, duelID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	d, err := queries.GetDuel(repo, ctx, duelID)
	if err != nil {
		log.Printf("duel %s: couldn't load it to sum up: %v", duelID, err)
		return
	}
	host := LoadHost(ctx, repo, d.HostID)
	summary := stockSummary(d)
	if talker := LoadTalker(ctx, repo, cfg); talker != nil {
		system := summaryRules
		if host.prompt != "" {
			system += "\n\nWho you are:\n" + strings.TrimSpace(host.prompt)
		}
		raw, err := talker.Talk(ctx, system, summaryFacts(d), "duel_summary", summarySchema)
		var out struct {
			Summary string `json:"summary"`
		}
		if err == nil && json.Unmarshal([]byte(raw), &out) == nil && strings.TrimSpace(out.Summary) != "" {
			summary = trimNote(out.Summary, 320)
		} else if err != nil {
			log.Printf("duel %s: host couldn't write the summary: %v", duelID, err)
		}
	}
	if err := queries.SetDuelSummary(repo, ctx, duelID, summary); err != nil {
		log.Printf("duel %s: couldn't save the summary: %v", duelID, err)
	}
}

// summaryFacts is what happened, for the host to sum up.
func summaryFacts(d models.Duel) string {
	names := map[string]string{d.Challenger.ID: d.Challenger.Username, d.Opponent.ID: d.Opponent.Username}
	type guess struct {
		Guess string `json:"guess"`
		Score int    `json:"scorePercent"`
		Exact bool   `json:"exactMatch"`
	}
	type round struct {
		Drawer  string  `json:"drawer"`
		Guesser string  `json:"guesser"`
		Prompt  string  `json:"prompt"`
		Guesses []guess `json:"guesses"`
		Best    *int    `json:"bestPercent"`
		Note    string  `json:"note,omitempty"`
	}
	var rounds []round
	for _, r := range d.Rounds {
		rr := round{Drawer: names[r.DrawerID], Guesser: names[r.GuesserID], Prompt: r.Prompt, Best: r.Score}
		for _, g := range r.Guesses {
			rr.Guesses = append(rr.Guesses, guess{g.Guess, g.Score, g.Exact})
		}
		if r.Score == nil {
			rr.Note = "never played: the duel ran out of time"
		}
		rounds = append(rounds, rr)
	}
	combined, complete := Combined(d)
	facts, _ := json.Marshal(map[string]any{"rounds": rounds, "combinedPercent": combined, "complete": complete, "status": d.Status})
	return string(facts)
}

func stockSummary(d models.Duel) string {
	combined, complete := Combined(d)
	if combined == nil {
		return "Well, that duel never got going. The canvas sits blank, the pencils weep. Another time!"
	}
	if !complete {
		return fmt.Sprintf("Only one round got played, and it scored %d%%. Half a duel is still half a legend.", *combined)
	}
	verdict := "you two need more practice reading each other's scribbles"
	switch {
	case *combined >= 90:
		verdict = "practically one brain sharing a pencil"
	case *combined >= 70:
		verdict = "a seriously solid team"
	case *combined >= 45:
		verdict = "on roughly the same page, if not the same line"
	}
	return fmt.Sprintf("The duel is done! Together you scored %d%%: %s.", *combined, verdict)
}

// ---- Reminders and expiry ----

const reminderInterval = 15 * time.Minute

// StartReminders checks every so often for duels stuck on someone: it reminds them once
// after RemindAfter, and gives up on the duel after ExpireAfter, telling both players.
// Cloud Run starves this loop between requests, so the cron tick endpoint also runs
// RemindOrExpire; claims keep the two from reminding twice.
func StartReminders(cfg *config.Config, repo *sql.DB) {
	go func() {
		ticker := time.NewTicker(reminderInterval)
		defer ticker.Stop()
		for {
			if err := RemindOrExpire(context.Background(), repo, cfg, time.Now()); err != nil {
				log.Printf("duel reminders: %v", err)
			}
			<-ticker.C
		}
	}()
}

// RemindOrExpire does one pass over the duels that are waiting on someone.
func RemindOrExpire(ctx context.Context, repo *sql.DB, cfg *config.Config, now time.Time) error {
	stale, err := queries.ListStaleDuels(repo, ctx, RemindAfter)
	if err != nil {
		return err
	}
	for _, d := range stale {
		turnID := TurnUserID(d)
		if turnID == "" {
			continue
		}
		waiting := d.Other(turnID)
		slacker := d.Other(waiting.ID)

		if now.Sub(d.UpdatedAt) >= ExpireAfter {
			ended, err := queries.EndDuel(repo, ctx, d.ID, models.DuelExpired)
			if err != nil || !ended {
				continue
			}
			// Someone who never got a drawing never knew the duel was on
			if d.Rounds[0].DrawnAt != nil {
				Notify(repo, cfg, waiting.ID, d.ID, "duel timed out",
					fmt.Sprintf("%s never took their turn, so your duel ended. See how far you got.", slacker.Username), slacker)
			}
			Notify(repo, cfg, slacker.ID, d.ID, "duel timed out",
				fmt.Sprintf("your duel with %s ran out of time. Start a new one?", waiting.Username), waiting)
			go WriteSummary(repo, cfg, d.ID)
			continue
		}

		claimed, err := queries.ClaimDuelReminder(repo, ctx, d.ID, RemindAfter)
		if err != nil || !claimed {
			continue
		}
		Notify(repo, cfg, turnID, d.ID, "your duel is waiting", TurnMessage(d, turnID, waiting.Username), waiting)
	}
	return nil
}

// TurnMessage is the push for whoever's turn it now is.
func TurnMessage(d models.Duel, turnID, otherName string) string {
	_, phase := Current(d)
	if phase == PhaseGuess {
		return fmt.Sprintf("%s drew something for you. You've got 3 guesses to read their mind.", otherName)
	}
	return fmt.Sprintf("your turn to draw for %s. You'll get a secret prompt and one minute.", otherName)
}
