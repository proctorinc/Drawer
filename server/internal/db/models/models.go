package models

import (
	"time"
)

// DailyPrompt represents the data returned for the daily challenge.
type DailyPrompt struct {
	Day    string   `json:"day"` // Format: YYYY-MM-DD
	Colors []string `json:"colors"`
	// The pencils handed out for the day; empty means the usual three: the first three
	// colors at the default size
	Pencils   []Pencil `json:"pencils,omitempty"`
	Prompt    string   `json:"prompt"`
	CreatedBy *User    `json:"createdBy"`
}

// Pencil is one color a prompt hands out, and how thick it draws (in canvas units;
// the default pencil is 20)
type Pencil struct {
	Color string  `json:"color"`
	Size  float64 `json:"size"`
}

type PromptSuggestion struct {
	ID        string    `json:"id"`
	Prompt    string    `json:"prompt"`
	CreatedBy User      `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

// User represents basic user profile information.
type User struct {
	ID         string    `json:"id"`
	Username   string    `json:"username"`
	Email      string    `json:"-"` // Private: only an Account sends it
	Role       string    `json:"-"` // Omitted from JSON responses
	CreatedAt  time.Time `json:"createdAt"`
	AvatarType string    `json:"avatarType"`
	AvatarURL  string    `json:"avatarUrl"`
	Decoration string    `json:"decoration"`         // The worn decoration's reward id, or "" for none
	ColorHue   *int      `json:"colorHue,omitempty"` // The hue (0-359) they picked, or nil to use the color from their name
}

// Account is a User as its owner (or an admin) sees it: email included.
// Everyone else gets a plain User, so emails never leak to other players.
type Account struct {
	User
	Email   string `json:"email"`
	IsAdmin bool   `json:"isAdmin"`
	// HasBeta lets them into the beta zone (admins always have it)
	HasBeta bool `json:"hasBeta"`
	// ImpersonatedBy is the username of the admin viewing as this user, if any
	ImpersonatedBy string `json:"impersonatedBy,omitempty"`
}

func (u User) Account() Account {
	return Account{User: u, Email: u.Email, IsAdmin: u.Role == "admin"}
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
	CreatedBy  *User           `json:"createdBy"`
	// The AI judge's score and comment, once it has one (or while it's writing it)
	AIReview *AIReview `json:"aiReview"`
	// What the judge has said since, in the comments, oldest first; only on a single doodle
	AIReplies []AIReply `json:"aiReplies,omitempty"`
	// The judge is writing its automatic answer to an @mention; only on a single doodle
	AIReplyPending bool `json:"aiReplyPending,omitempty"`
	// Pinned the day after its prompt, finishing a doodle the rollover interrupted
	Late bool `json:"late,omitempty"`
	// Drawn with a redo, after its prompt had closed
	Redo bool `json:"redo,omitempty"`
}

type UserStats struct {
	TotalDrawings int `json:"totalDrawings"`
	CurrentStreak int `json:"currentStreak"`
}

// GetMeResponse is the structure for the /me endpoint response.
type GetMeResponse struct {
	User    User                    `json:"user"`
	Prompts []*UserPromptSubmission `json:"prompts"`
	// Feed is always empty now that the feed pages through /feed. It stays only so app tabs
	// opened before that change don't crash on a missing field; drop it once they've reloaded.
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
	// Comments on a drawing you made or commented on, grouped per drawing
	ActivityActionComment ActivityAction = "comment"
	// Reactions to your drawing, grouped per drawing
	ActivityActionReaction ActivityAction = "reaction"
	// Reactions to your comment, grouped per comment
	ActivityActionCommentReaction ActivityAction = "comment_reaction"
	ActivityActionPoke            ActivityAction = "poke"
	// Yours or a friend's
	ActivityActionAchievement    ActivityAction = "achievement"
	ActivityActionLevelUp        ActivityAction = "level_up"
	ActivityActionFriendRequest  ActivityAction = "friend_request"
	ActivityActionFriendAccepted ActivityAction = "friend_accepted"
	// An AI judge finished reviewing your doodle
	ActivityActionAIReview ActivityAction = "ai_review"
)

type Activity struct {
	ID string `json:"id"`
	// Who did it; for a grouped row, whoever did so most recently
	User   User           `json:"user"`
	Action ActivityAction `json:"action"`
	// When it happened; for a grouped row, its newest item
	Date   time.Time `json:"date"`
	IsRead bool      `json:"isRead"`
	// Grouped rows only: everyone involved, newest first, and how many items were folded in
	Users []User `json:"users,omitempty"`
	Count int    `json:"count,omitempty"`
	// The newest comment in a thread, or the comment that was reacted to
	Comment *Comment `json:"comment,omitempty"`
	// Each kind of reaction in a reaction row
	ReactionIDs []string `json:"reactionIds,omitempty"`
	// The achievement earned; on a friend's day of achievements, their newest
	Achievement *Achievement `json:"achievement,omitempty"`
	// A friend's day of achievements only: the newest few, newest first (Count has them all)
	Achievements []Achievement       `json:"achievements,omitempty"`
	Level        int                 `json:"level,omitempty"`
	Submission   *ActivitySubmission `json:"submission,omitempty"`
	// The AI judge's review, on an ai_review row (User is then you, the artist)
	AIReview *AIReview `json:"aiReview,omitempty"`
}

// ActivitySubmission is the drawing an activity happened on
type ActivitySubmission struct {
	ID       string `json:"id"`
	Prompt   string `json:"prompt"`
	ImageUrl string `json:"imageUrl"`
	Artist   User   `json:"artist"`
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
	NotificationTypeEvent            NotificationType = "event"
	NotificationTypeAIReview         NotificationType = "ai_review"
)

type NotificationData struct {
	Type     NotificationType `json:"type"`
	Title    string           `json:"title"`
	Body     string           `json:"body"`
	URL      string           `json:"url,omitempty"`
	UserID   string           `json:"userId,omitempty"`
	Username string           `json:"username,omitempty"`
	Action   string           `json:"action,omitempty"`
	// Icon overrides the default app logo, e.g. an event's themed logo
	Icon string `json:"icon,omitempty"`
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
	Progress         int           `json:"progress"`
	Best             *int          `json:"best,omitempty"` // Streaks: the longest run, when it beats the current one
	Reward           *RewardUnlock `json:"reward"`
	EventSlug        *string       `json:"eventSlug"` // Set for event stickers, which count only that event's doodles
	// XP is what earning it is worth
	XP int `json:"xp"`
	// Category is the achievements page tab it's on: drawing, streaks, friends, judges, levels or events
	Category string `json:"category"`
	// Hidden achievements keep how to earn them a secret until they're earned
	Hidden bool `json:"hidden"`
	// Secret is set when the details were withheld: a hidden achievement or event sticker
	// not earned yet. Name, description, goal, progress and reward are then blank.
	Secret bool `json:"secret"`
	// Celebrated is set once the player has been shown this one being earned, on any device
	Celebrated bool `json:"celebrated"`
	// Path is the line of achievements this one is a step on, each leading to the next;
	// one alone on its path has its own id here. PathStep is its place on it, from 1.
	Path     string `json:"path"`
	PathStep int    `json:"pathStep"`
}

type RewardUnlock struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"-"`
}
