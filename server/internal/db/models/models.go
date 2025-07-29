package models

import (
	"time"
)

// DailyPrompt represents the data returned for the daily challenge.
type DailyPrompt struct {
	Day    string   `json:"day"` // Format: YYYY-MM-DD
	Colors []string `json:"colors"`
	Prompt string   `json:"prompt"`
}

// User represents basic user profile information.
type User struct {
	ID         string    `json:"id"`
	Username   string    `json:"username"`
	Email      string    `json:"email"`
	Role       string    `json:"-"` // Omitted from JSON responses
	CreatedAt  time.Time `json:"createdAt"`
	AvatarType string    `json:"avatarType"`
	AvatarURL  string    `json:"avatarUrl"`
}

// Reaction represents a user's reaction to content
type Reaction struct {
	ID         string    `json:"id"`
	User       User      `json:"user"`
	ReactionID string    `json:"reactionId"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ReactionCount represents the count of a specific reaction type
type ReactionCount struct {
	ReactionID string `json:"reactionId"`
	Count      int    `json:"count"`
}

// ReactionResponse represents the complete reaction data for content
type ReactionResponse struct {
	Reactions []Reaction      `json:"reactions"`
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
	IsFavorite bool            `json:"isFavorite"`
	CreatedAt  time.Time       `json:"createdAt"`
}

type UserStats struct {
	TotalDrawings int `json:"totalDrawings"`
	CurrentStreak int `json:"currentStreak"`
}

// GetMeResponse is the structure for the /me endpoint response.
type GetMeResponse struct {
	User       User                    `json:"user"`
	Prompts    []*UserPromptSubmission `json:"prompts"`
	Feed       []*UserPromptSubmission `json:"feed"`
	Friends    []User                  `json:"friends"`
	Stats      UserStats               `json:"stats"`
	Favorites  []*FavoriteSubmission   `json:"favorites"`
	Invitation *InvitationStatus       `json:"invitation"`
}

type FavoriteSubmission struct {
	ID         string               `json:"id"`
	Submission UserPromptSubmission `json:"submission"`
	CreatedAt  time.Time            `json:"createdAt"`
	OrderNum   int                  `json:"orderNum"`
}

type ActivityAction string

const (
	ActivityActionComment  ActivityAction = "comment"
	ActivityActionReaction ActivityAction = "reaction"
)

type Activity struct {
	ID         string         `json:"id"`
	User       User           `json:"user"`
	Action     ActivityAction `json:"action"`
	Date       time.Time      `json:"date"`
	IsRead     bool           `json:"isRead"`
	Comment    *Comment       `json:"comment,omitempty"`
	Reaction   *Reaction      `json:"reaction,omitempty"`
	Submission *struct {
		ID       string `json:"id"`
		Prompt   string `json:"prompt"`
		ImageUrl string `json:"imageUrl"`
	} `json:"submission,omitempty"`
}

type PushSubscription struct {
	Endpoint string
	P256dh   string
	Auth     string
}

type NotificationType string

const (
	NotificationTypeFriendSubmission NotificationType = "friend_submission"
	NotificationTypeReaction         NotificationType = "reaction"
	NotificationTypeComment          NotificationType = "comment"
)

type NotificationData struct {
	Type     NotificationType `json:"type"`
	Title    string           `json:"title"`
	Body     string           `json:"body"`
	URL      string           `json:"url,omitempty"`
	UserID   string           `json:"userId,omitempty"`
	Username string           `json:"username,omitempty"`
	Action   string           `json:"action,omitempty"`
}

type Invitation struct {
	Inviter   User      `json:"inviter"`
	Invitee   User      `json:"invitee"`
	CreatedAt time.Time `json:"createdAt"`
}

type InvitationStatus struct {
	Inviter   User      `json:"inviter"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type InvitationResponse struct {
	Invitee []Invitation `json:"invitee"`
	Invited []Invitation `json:"invited"`
}

type Achievement struct {
	ID               string        `json:"id"`
	Name             string        `json:"name"`
	Description      string        `json:"description"`
	ImageURL         string        `json:"imageUrl"`
	AchievedAt       *time.Time    `json:"achievedAt"`
	AchievementField string        `json:"achievementField"`
	AchievementValue int           `json:"achievementValue"`
	Reward           *RewardUnlock `json:"reward"`
}

type RewardUnlock struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"-"`
}
