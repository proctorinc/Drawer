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

// Comment represents a comment on a prompt submission.
type Comment struct {
	User User   `json:"user"`
	Text string `json:"text"`
	CreatedAt time.Time `json:"createdAt"`
}

// UserPromptSubmission combines the daily prompt details with the user's submitted canvas data.
type UserPromptSubmission struct {
	ID         string    `json:"id"`
	Day        string    `json:"day"`
	Colors     []string  `json:"colors"`
	Prompt     string    `json:"prompt"`
	User       User      `json:"user"`
	ImageUrl   string    `json:"imageUrl"`
	Comments   []Comment `json:"comments"`
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
}
