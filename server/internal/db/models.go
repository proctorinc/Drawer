package db

import (
	"time"
)

// DailyPrompt represents the data returned for the daily challenge.
type DailyPrompt struct {
	Day    string   `json:"day"` // Format: YYYY-MM-DD
	Colors []string `json:"colors"`
	Prompt string   `json:"prompt"`
}

type DailyPromptWithCompletion struct {
	Day         string   `json:"day"` // Format: YYYY-MM-DD
	Colors      []string `json:"colors"`
	Prompt      string   `json:"prompt"`
	IsCompleted bool     `json:"isCompleted"`
}

// User represents basic user profile information.
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

// Reaction represents a user's reaction to content
type Reaction struct {
	ID        string    `json:"id"`
	User      User      `json:"user"`
	ReactionID string   `json:"reactionId"`
	CreatedAt time.Time `json:"createdAt"`
}

// ReactionCount represents the count of a specific reaction type
type ReactionCount struct {
	ReactionID string `json:"reactionId"`
	Count      int    `json:"count"`
}

// ReactionResponse represents the complete reaction data for content
type ReactionResponse struct {
	Reactions []Reaction     `json:"reactions"`
	Counts    []ReactionCount `json:"counts"`
}

// Comment represents a comment on a prompt submission.
type Comment struct {
	ID        string          `json:"id"`
	User      User            `json:"user"`
	Text      string          `json:"text"`
	CreatedAt time.Time       `json:"createdAt"`
	Reactions []Reaction      `json:"reactions"`
	Counts    []ReactionCount `json:"counts"`
}

// UserPromptSubmission combines the daily prompt details with the user's submitted canvas data.
type UserPromptSubmission struct {
	ID         string          `json:"id"`
	Day        string          `json:"day"`
	Colors     []string        `json:"colors"`
	Prompt     string          `json:"prompt"`
	User       User            `json:"user"`
	ImageUrl   string          `json:"imageUrl"`
	Comments   []Comment       `json:"comments"`
	Reactions  []Reaction      `json:"reactions"`
	Counts     []ReactionCount `json:"counts"`
	IsFavorite bool			   `json:"isFavorite"`
}

type UserStats struct {
	TotalDrawings int			`json:"totalDrawings"`
	CurrentStreak int			`json:"currentStreak"`
}

// GetMeResponse is the structure for the /me endpoint response.
type GetMeResponse struct {
	User    User                    `json:"user"`
	Prompts []*UserPromptSubmission `json:"prompts"`
	Feed    []*UserPromptSubmission `json:"feed"`
	Friends []User                  `json:"friends"`
	Stats   UserStats               `json:"stats"`
	Favorites []*FavoriteSubmission `json:"favorites"`
}

type FavoriteSubmission struct {
	ID           string    `json:"id"`
	Submission UserPromptSubmission    `json:"submission"`
	CreatedAt    time.Time `json:"createdAt"`
	OrderNum     int       `json:"orderNum"`
}
