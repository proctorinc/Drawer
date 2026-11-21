package models

import (
	"encoding/json"
	"time"
)

// Duel statuses
const (
	DuelActive    = "active"
	DuelDone      = "done"
	DuelExpired   = "expired"   // Someone never played their turn
	DuelCancelled = "cancelled" // Someone called it off
)

// Duel is a sketch duel between two players, with both its rounds.
type Duel struct {
	ID               string
	Challenger       User
	Opponent         User
	Status           string
	HostID           string
	Summary          string
	RemindedAt       *time.Time
	ChallengerSeenAt *time.Time
	OpponentSeenAt   *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
	FinishedAt       *time.Time
	Rounds           []DuelRound
}

// DuelRound is one player drawing and the other guessing.
type DuelRound struct {
	Number        int
	DrawerID      string
	GuesserID     string
	Prompt        string
	Keywords      []string
	DrawStartedAt *time.Time
	Image         string // A data:image/png URL; "" until drawn. Not loaded in lists.
	HasImage      bool
	DrawnAt       *time.Time
	Score         *int
	FinishedAt    *time.Time
	Guesses       []DuelGuess
}

// DuelGuess is one try at a round's prompt. Feedback is the scorer's JSON breakdown.
type DuelGuess struct {
	Attempt   int
	Guess     string
	Score     int
	Exact     bool
	Feedback  json.RawMessage
	Note      string
	CreatedAt time.Time
}

// SeenAt is when the user last looked at the duel.
func (d Duel) SeenAt(userID string) *time.Time {
	if userID == d.Challenger.ID {
		return d.ChallengerSeenAt
	}
	return d.OpponentSeenAt
}

// Other is the player who isn't userID.
func (d Duel) Other(userID string) User {
	if userID == d.Challenger.ID {
		return d.Opponent
	}
	return d.Challenger
}

// Has reports whether the user is one of the two players.
func (d Duel) Has(userID string) bool {
	return userID == d.Challenger.ID || userID == d.Opponent.ID
}

const NotificationTypeDuel NotificationType = "duel"
