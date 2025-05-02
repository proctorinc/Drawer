package db

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
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// DailyPromptWithPng combines the daily prompt details with the user's submitted image path/URL.
type UserPromptSubmission struct {
	Day      string   `json:"day"` // Format: YYYY-MM-DD
	Colors   []string `json:"colors"`
	Prompt   string   `json:"prompt"`
	ImageURL string   `json:"imageUrl"` // URL or path to the saved PNG
	User     User     `json:"user"`     // User who submitted the prompt
}

// GetMeResponse is the structure for the /me endpoint response.
type GetMeResponse struct {
	User    User                              `json:"user"`
	Prompts []UserPromptSubmission            `json:"prompts"`
	Feed    map[string][]UserPromptSubmission `json:"feed"`
	Friends []User                            `json:"friends"`
}
