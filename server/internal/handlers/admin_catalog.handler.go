package handlers

import (
	"database/sql"
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/utils"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// These read-only listings back the admin pages, which show everything in the app for QA.

// respondList sends {key: list}, or a 500 when loading it failed
func respondList(c *gin.Context, key string, list any, err error) {
	if err != nil {
		log.Printf("Admin: error listing %s: %v", key, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to list "+key))
		return
	}
	c.JSON(http.StatusOK, gin.H{key: list})
}

func HandleAdminListUsers(c *gin.Context) {
	users, err := queries.GetAdminUsers(context.GetCtx(c).DB, c.Request.Context())
	respondList(c, "users", users, err)
}

func HandleAdminListPrompts(c *gin.Context) {
	prompts, err := queries.GetAllPrompts(context.GetCtx(c).DB, c.Request.Context())
	respondList(c, "prompts", prompts, err)
}

const adminSubmissionLimit = 120

func HandleAdminListSubmissions(c *gin.Context) {
	appCtx := context.GetCtx(c)
	submissions, err := queries.GetRecentSubmissions(appCtx.DB, c.Request.Context(), appCtx.Config, adminSubmissionLimit)
	respondList(c, "submissions", submissions, err)
}

func HandleAdminListAchievements(c *gin.Context) {
	achievements, err := queries.GetAllAchievements(context.GetCtx(c).DB, c.Request.Context())
	respondList(c, "achievements", achievements, err)
}

func HandleAdminListRewards(c *gin.Context) {
	rewards, err := queries.GetAllRewards(context.GetCtx(c).DB, c.Request.Context())
	respondList(c, "rewards", rewards, err)
}

func HandleAdminReactionUsage(c *gin.Context) {
	usage, err := queries.GetReactionUsage(context.GetCtx(c).DB, c.Request.Context())
	respondList(c, "usage", usage, err)
}

// LevelStats is a level and how many players are on it now
type LevelStats struct {
	Level
	Players int `json:"players"`
}

// QuestStats is a weekly quest and how far everyone has got with it this week
type QuestStats struct {
	Quest
	Started   int `json:"started"`
	Completed int `json:"completed"`
}

// Progression is how activity turns into XP, levels and quests, and where every player stands
type Progression struct {
	XPRules []XPRule     `json:"xpRules"`
	Players int          `json:"players"`
	Levels  []LevelStats `json:"levels"`
	Quests  []QuestStats `json:"quests"`
	Week    Week         `json:"week"`
}

// At least this many levels are listed, so the ladder ahead of everyone shows too
const minLevelsShown = 20

// progressionStats places every player (by user id) on a level by lifetime XP, and on
// each quest by this week's activity
func progressionStats(lifetime, weekly map[string]queries.ActivityCounts) ([]LevelStats, []QuestStats) {
	onLevel := map[int]int{}
	top := minLevelsShown
	for _, counts := range lifetime {
		level := levelForXP(xpFor(counts)).Level
		onLevel[level]++
		top = max(top, level)
	}
	levels := make([]LevelStats, 0, top)
	for xp := 0; len(levels) < top; xp = levels[len(levels)-1].NextLevelXP {
		level := levelForXP(xp)
		levels = append(levels, LevelStats{Level: level, Players: onLevel[level.Level]})
	}

	quests := []QuestStats{}
	for _, quest := range weeklyQuests(queries.ActivityCounts{}) {
		quests = append(quests, QuestStats{Quest: Quest{ID: quest.ID, Title: quest.Title, Description: quest.Description, Goal: quest.Goal}})
	}
	for userID := range lifetime {
		for i, quest := range weeklyQuests(weekly[userID]) {
			if quest.Progress > 0 {
				quests[i].Started++
			}
			if quest.Progress >= quest.Goal {
				quests[i].Completed++
			}
		}
	}
	return levels, quests
}

// HandleAdminProgression shows the XP, level and quest rules, and how every player is doing
func HandleAdminProgression(c *gin.Context) {
	repo := context.GetCtx(c).DB
	ctx := c.Request.Context()

	users, err := queries.GetAllUsers(repo, ctx, "")
	if err != nil {
		respondList(c, "progression", nil, err)
		return
	}
	userIDs := make([]string, len(users))
	for i, u := range users {
		userIDs[i] = u.ID
	}

	lifetime, err := queries.GetActivityCounts(repo, ctx, userIDs, queries.BeginningOfTime, queries.EndOfTime)
	if err != nil {
		respondList(c, "progression", nil, err)
		return
	}
	// Players with no activity at all still count, on level 1 with nothing started
	for _, id := range userIDs {
		lifetime[id] = lifetime[id]
	}
	week, nextWeek := weekBounds(time.Now())
	weekly, err := queries.GetActivityCounts(repo, ctx, userIDs, week, nextWeek)
	if err != nil {
		respondList(c, "progression", nil, err)
		return
	}

	levels, quests := progressionStats(lifetime, weekly)
	c.JSON(http.StatusOK, Progression{
		XPRules: xpRules,
		Players: len(users),
		Levels:  levels,
		Quests:  quests,
		Week: Week{
			Start:    utils.GetFormattedDate(week),
			End:      utils.GetFormattedDate(nextWeek.AddDate(0, 0, -1)),
			ResetsAt: nextWeek,
		},
	})
}

// AdminLogEntry is a LogEntry with its people filled in
type AdminLogEntry struct {
	queries.LogEntry
	Actor  *models.User `json:"actor"`
	Target *models.User `json:"target"`
}

const adminLogLimit = 300

func HandleAdminActivityLog(c *gin.Context) {
	repo := context.GetCtx(c).DB
	ctx := c.Request.Context()

	entries, err := queries.GetActivityLog(repo, ctx, adminLogLimit)
	if err != nil {
		respondList(c, "entries", nil, err)
		return
	}

	ids := map[string]bool{}
	for _, e := range entries {
		ids[e.ActorID] = true
		if e.TargetID != nil {
			ids[*e.TargetID] = true
		}
	}
	userIDs := make([]string, 0, len(ids))
	for id := range ids {
		userIDs = append(userIDs, id)
	}
	users, err := queries.GetUsersByIDs(repo, ctx, userIDs)
	if err != nil {
		respondList(c, "entries", nil, err)
		return
	}
	byID := make(map[string]*models.User, len(users))
	for i := range users {
		byID[users[i].ID] = &users[i]
	}

	response := make([]AdminLogEntry, len(entries))
	for i, e := range entries {
		response[i] = AdminLogEntry{LogEntry: e, Actor: byID[e.ActorID]}
		if e.TargetID != nil {
			response[i].Target = byID[*e.TargetID]
		}
	}
	respondList(c, "entries", response, nil)
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type AcceptSuggestionRequest struct {
	Day    string   `json:"day" binding:"required"`
	Prompt string   `json:"prompt" binding:"required"`
	Colors []string `json:"colors" binding:"required,min=1"`
}

// HandleAcceptPromptSuggestion schedules a suggestion, as tweaked by the admin, on a free day
func HandleAcceptPromptSuggestion(c *gin.Context) {
	appCtx := context.GetCtx(c)
	id := c.Param("id")

	var req AcceptSuggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid request: "+err.Error()))
		return
	}
	req.Prompt = strings.TrimSpace(req.Prompt)
	if _, err := time.Parse(utils.DateFormat, req.Day); err != nil || req.Prompt == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("A YYYY-MM-DD day and a prompt are required"))
		return
	}
	for _, color := range req.Colors {
		if !hexColor.MatchString(color) {
			c.AbortWithStatusJSON(http.StatusBadRequest, Error("Colors must be hex, like #ff0000"))
			return
		}
	}

	err := queries.AcceptPromptSuggestion(appCtx.DB, c.Request.Context(), id, req.Day, req.Prompt, req.Colors)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Suggestion not found"))
	case errors.Is(err, queries.ErrDayTaken):
		c.AbortWithStatusJSON(http.StatusConflict, Error(req.Day+" already has a prompt"))
	case err != nil:
		log.Printf("Admin: error accepting suggestion %s: %v", id, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to accept suggestion"))
	default:
		c.JSON(http.StatusOK, gin.H{"day": req.Day})
	}
}

func HandleDismissPromptSuggestion(c *gin.Context) {
	id := c.Param("id")
	err := queries.DeletePromptSuggestion(context.GetCtx(c).DB, c.Request.Context(), id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Suggestion not found"))
	case err != nil:
		log.Printf("Admin: error dismissing suggestion %s: %v", id, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to dismiss suggestion"))
	default:
		c.Status(http.StatusNoContent)
	}
}
