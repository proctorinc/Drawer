package stats

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/events"
	"drawer-service-backend/internal/xp"
	"fmt"
	"log"
)

type StatsField string

var (
	SUBMISSION_ACTIVE_STREAK  StatsField = "SUBMISSION_ACTIVE_STREAK"
	SUBMISSION_STREAK         StatsField = "SUBMISSION_STREAK"
	SUBMISSION_TOTAL          StatsField = "SUBMISSION_TOTAL"
	COMMENT_TOTAL             StatsField = "COMMENT_TOTAL"
	REACTION_TOTAL            StatsField = "REACTION_TOTAL"
	REACTION_SUBMISSION_TOTAL StatsField = "REACTION_SUBMISSION_TOTAL"
	REACTION_COMMENT_TOTAL    StatsField = "REACTION_COMMENT_TOTAL"
	FRIEND_TOTAL              StatsField = "FRIEND_TOTAL"
	// Event stickers: distinct days doodled during the achievement's event (see event_achievements)
	EVENT_SUBMISSION_TOTAL StatsField = "EVENT_SUBMISSION_TOTAL"
	// Event stickers: distinct days doodled during the event's countdown (e.g. Nov 27 - Dec 25)
	EVENT_COUNTDOWN_TOTAL StatsField = "EVENT_COUNTDOWN_TOTAL"

	// Doodles pinned to your book
	FAVORITE_TOTAL StatsField = "FAVORITE_TOTAL"
	// Reactions friends left on your doodles and comments (not your own)
	REACTION_RECEIVED_TOTAL StatsField = "REACTION_RECEIVED_TOTAL"
	// Cry-laugh reactions friends left on your doodles and comments
	CRY_LAUGH_RECEIVED_TOTAL StatsField = "CRY_LAUGH_RECEIVED_TOTAL"
	// Pokes sent to friends
	POKE_TOTAL StatsField = "POKE_TOTAL"
	// Prompt suggestions that became a daily prompt
	PROMPT_PICKED_TOTAL StatsField = "PROMPT_PICKED_TOTAL"
	// Your level, from your lifetime XP
	LEVEL StatsField = "LEVEL"
	// AI judges: doodles reviewed, best score (rounded down), doodles scored 8+, doodles
	// scored under 2, and different judges met
	AI_REVIEW_TOTAL StatsField = "AI_REVIEW_TOTAL"
	AI_BEST_SCORE   StatsField = "AI_BEST_SCORE"
	AI_GREAT_TOTAL  StatsField = "AI_GREAT_TOTAL"
	AI_LOW_TOTAL    StatsField = "AI_LOW_TOTAL"
	AI_JUDGES_MET   StatsField = "AI_JUDGES_MET"
	// Doodles the Grinch scored a flat 0, his rarest verdict (a secret achievement)
	GRINCH_ZERO_TOTAL StatsField = "GRINCH_ZERO_TOTAL"
	// Doodles bad enough that the Grinch took you as his accomplice (a secret achievement)
	GRINCH_SIDE_TOTAL StatsField = "GRINCH_SIDE_TOTAL"
)

// AI_FIELDS are the achievement fields a finished AI review can move
var AI_FIELDS = []string{
	string(AI_REVIEW_TOTAL), string(AI_BEST_SCORE), string(AI_GREAT_TOTAL), string(AI_LOW_TOTAL), string(AI_JUDGES_MET),
	string(GRINCH_ZERO_TOTAL), string(GRINCH_SIDE_TOTAL),
}

// countQueries are the fields that are a single count for the user
var countQueries = map[StatsField]func(*sql.DB, context.Context, string) (int, error){
	FAVORITE_TOTAL:      queries.CalculateFavoriteCount,
	POKE_TOTAL:          queries.CalculatePokeCount,
	PROMPT_PICKED_TOTAL: queries.CalculatePromptPickedCount,
	AI_REVIEW_TOTAL:     queries.CalculateAIReviewCount,
	AI_BEST_SCORE:       queries.CalculateAIBestScore,
	AI_GREAT_TOTAL:      queries.CalculateAIGreatCount,
	AI_LOW_TOTAL:        queries.CalculateAILowCount,
	AI_JUDGES_MET:       queries.CalculateAIJudgesMet,
	GRINCH_ZERO_TOTAL:   queries.CalculateGrinchZeroCount,
	GRINCH_SIDE_TOTAL:   queries.CalculateGrinchSideCount,
}

type StatsService struct {
	DB    *sql.DB
	Ctx   context.Context
	Stats UserStats
	// Counts for the newer fields, worked out once per service (one check of many
	// achievements shares them)
	counts   map[StatsField]int
	lifetime *queries.ActivityCounts
	grinch   *queries.GrinchSundays
}

type UserStats struct {
	SubmissionActiveStreak  *int
	SubmissionMaxStreak     *int
	SubmissionTotal         *int
	CommentTotal            *int
	ReactionTotal           *int
	ReactionCommentTotal    *int
	ReactionSubmissionTotal *int
	FriendTotal             *int
}

func NewStatsService(db *sql.DB, ctx context.Context, userId string) *StatsService {
	return &StatsService{
		DB:    db,
		Ctx:   ctx,
		Stats: UserStats{},
	}
}

func getAllCalculatedStats(repo *sql.DB, ctx context.Context, userId string, statTypes []string) (UserStats, error) {
	stats := UserStats{}
	calculatedStats, err := queries.GetCalculatedStats(repo, ctx, userId, statTypes)

	if err != nil {
		return stats, err
	}

	if submissionActiveStreak, ok := calculatedStats[string(SUBMISSION_ACTIVE_STREAK)]; ok {
		stats.SubmissionActiveStreak = &submissionActiveStreak
	}

	if submissionMaxStreak, ok := calculatedStats[string(SUBMISSION_STREAK)]; ok {
		stats.SubmissionMaxStreak = &submissionMaxStreak
	}

	if submissionTotal, ok := calculatedStats[string(SUBMISSION_TOTAL)]; ok {
		stats.SubmissionTotal = &submissionTotal
	}

	if commentTotal, ok := calculatedStats[string(COMMENT_TOTAL)]; ok {
		stats.CommentTotal = &commentTotal
	}

	if reactionTotal, ok := calculatedStats[string(REACTION_TOTAL)]; ok {
		stats.ReactionTotal = &reactionTotal
	}

	if reactionCommentTotal, ok := calculatedStats[string(REACTION_COMMENT_TOTAL)]; ok {
		stats.ReactionCommentTotal = &reactionCommentTotal
	}

	if reactionSubmissionTotal, ok := calculatedStats[string(REACTION_SUBMISSION_TOTAL)]; ok {
		stats.ReactionSubmissionTotal = &reactionSubmissionTotal
	}

	if reactionFriendTotal, ok := calculatedStats[string(FRIEND_TOTAL)]; ok {
		stats.FriendTotal = &reactionFriendTotal
	}

	return stats, nil
}

func (ss *StatsService) CheckStatCompletion(userId string, achievement models.Achievement) (int, bool, error) {
	count := 0

	switch achievement.AchievementField {
	case string(SUBMISSION_ACTIVE_STREAK):
		val, err := ss.GetSubmissionActiveStreak(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(SUBMISSION_STREAK):
		val, err := ss.GetSubmissionStreak(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(SUBMISSION_TOTAL):
		val, err := ss.GetSubmissionTotal(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(COMMENT_TOTAL):
		val, err := ss.GetCommentTotal(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(REACTION_TOTAL):
		val, err := ss.GetReactionTotal(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(REACTION_COMMENT_TOTAL):
		val, err := ss.GetReactionCommentTotal(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(REACTION_SUBMISSION_TOTAL):
		val, err := ss.GetReactionSubmissionTotal(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(FRIEND_TOTAL):
		val, err := ss.GetFriendTotal(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(EVENT_SUBMISSION_TOTAL), string(EVENT_COUNTDOWN_TOTAL):
		val, err := ss.GetEventSubmissionTotal(userId, achievement)
		if err != nil {
			return 0, false, err
		}
		count = val
	case string(REACTION_RECEIVED_TOTAL), string(CRY_LAUGH_RECEIVED_TOTAL), string(LEVEL):
		lifetime, err := ss.getLifetime(userId)
		if err != nil {
			return 0, false, err
		}
		switch StatsField(achievement.AchievementField) {
		case REACTION_RECEIVED_TOTAL:
			count = lifetime.ReactionsReceived
		case CRY_LAUGH_RECEIVED_TOTAL:
			count = lifetime.CryLaughsReceived
		case LEVEL:
			count = xp.LevelFor(xp.For(lifetime)).Level
		}
	default:
		if val, ok, err := ss.doodlemasCount(userId, achievement); ok {
			if err != nil {
				return 0, false, err
			}
			count = val
			break
		}
		field := StatsField(achievement.AchievementField)
		calculate, ok := countQueries[field]
		if !ok {
			log.Printf("No applicable condition for achievement %v", achievement)
			break
		}
		if cached, ok := ss.counts[field]; ok {
			count = cached
			break
		}
		val, err := calculate(ss.DB, ss.Ctx, userId)
		if err != nil {
			return 0, false, err
		}
		if ss.counts == nil {
			ss.counts = map[StatsField]int{}
		}
		ss.counts[field] = val
		count = val
	}

	return count, count >= achievement.AchievementValue, nil
}

// getLifetime is the user's all-time activity, the same totals their XP comes from
func (ss *StatsService) getLifetime(userId string) (queries.ActivityCounts, error) {
	if ss.lifetime == nil {
		all, err := queries.GetActivityCounts(ss.DB, ss.Ctx, []string{userId}, queries.BeginningOfTime, queries.EndOfTime)
		if err != nil {
			return queries.ActivityCounts{}, err
		}
		lifetime := all[userId]
		ss.lifetime = &lifetime
	}
	return *ss.lifetime, nil
}

func (ss *StatsService) GetSubmissionActiveStreak(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	activeStreak := ss.Stats.SubmissionActiveStreak

	// If stats is not already calculated, calculate it
	if activeStreak == nil {
		streak, err := queries.CalculateSubmissionActiveStreak(repo, ctx, userId)

		if err != nil {
			log.Printf("Error calculating submission active streak for user %s: %v", userId, err)
			return 0, err
		}

		activeStreak = &streak
	}

	return *activeStreak, nil
}

func (ss *StatsService) GetSubmissionStreak(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	maxStreak := ss.Stats.SubmissionActiveStreak

	// If stat is not already calculated, calculate it
	if maxStreak == nil {
		streak, err := queries.CalculateSubmissionMaxStreak(repo, ctx, userId)

		if err != nil {
			log.Printf("Error calculating submission max streak for user %s: %v", userId, err)
			return 0, err
		}

		maxStreak = &streak
	}

	return *maxStreak, nil
}

func (ss *StatsService) GetSubmissionTotal(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	submissionCount := ss.Stats.SubmissionTotal

	// If stat is not already calculated, calculate it
	if submissionCount == nil {
		count, err := queries.CalculateSubmissionCount(repo, ctx, userId)

		if err != nil {
			log.Printf("Error calculating submission total count for user %s: %v", userId, err)
			return 0, err
		}

		submissionCount = &count
	}

	return *submissionCount, nil
}

func (ss *StatsService) GetReactionTotal(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	reactionCount := ss.Stats.ReactionTotal

	// If stat is not already calculated, calculate it
	if reactionCount == nil {
		count, err := queries.CalculateReactionCount(repo, ctx, userId)

		if err != nil {
			log.Printf("Error calculating submission active streak for user %s: %v", userId, err)
			return 0, err
		}

		reactionCount = &count
	}

	return *reactionCount, nil
}

func (ss *StatsService) GetReactionCommentTotal(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	commentReactions := ss.Stats.ReactionCommentTotal

	// If stats is not already calculated, calculate it
	if commentReactions == nil {
		count, err := queries.CalculateReactionCommentCount(repo, ctx, userId)

		if err != nil {
			log.Printf("Error calculating reaction comment total for user %s: %v", userId, err)
			return 0, err
		}

		commentReactions = &count
	}

	return *commentReactions, nil
}

func (ss *StatsService) GetReactionSubmissionTotal(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	submissionReactions := ss.Stats.ReactionSubmissionTotal

	// If stats is not already calculated, calculate it
	if submissionReactions == nil {
		count, err := queries.CalculateReactionSubmissionCount(repo, ctx, userId)

		if err != nil {
			log.Printf("Error calculating reaction submission total for user %s: %v", userId, err)
			return 0, err
		}

		submissionReactions = &count
	}

	return *submissionReactions, nil
}

func (ss *StatsService) GetCommentTotal(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	commentCount := ss.Stats.CommentTotal

	// If stats is not already calculated, calculate it
	if commentCount == nil {
		count, err := queries.CalculateCommentCount(repo, ctx, userId)

		if err != nil {
			log.Printf("Error calculating comment total for user %s: %v", userId, err)
			return 0, err
		}

		commentCount = &count
	}

	return *commentCount, nil
}

func (ss *StatsService) GetFriendTotal(repo *sql.DB, ctx context.Context, userId string) (int, error) {
	friendCount := ss.Stats.FriendTotal

	// If stats is not already calculated, calculate it
	if friendCount == nil {
		count, err := queries.CalculateFriendCount(repo, ctx, userId)

		if err != nil {
			log.Printf("Error calculating friend total for user %s: %v", userId, err)
			return 0, err
		}

		friendCount = &count
	}

	return *friendCount, nil
}

// GetEventSubmissionTotal counts the days the user doodled during an event sticker's event
// (or just its countdown, for EVENT_COUNTDOWN_TOTAL).
func (ss *StatsService) GetEventSubmissionTotal(userId string, achievement models.Achievement) (int, error) {
	event, err := queries.GetAchievementEvent(ss.DB, ss.Ctx, achievement.ID)
	if err != nil {
		return 0, fmt.Errorf("finding the event for achievement %s: %w", achievement.ID, err)
	}

	days := events.Days(event)
	if achievement.AchievementField == string(EVENT_COUNTDOWN_TOTAL) {
		countdown, ok := events.CountdownDayRange(event)
		if !ok {
			return 0, fmt.Errorf("event %s has no countdown for achievement %s", event.Slug, achievement.ID)
		}
		days = countdown
	}

	doodledDays, err := queries.GetUserSubmissionDays(ss.DB, ss.Ctx, userId, days.First, days.Last)
	if err != nil {
		return 0, err
	}
	return len(doodledDays), nil
}

// HERE
func CalculateSubmissionActiveStreak(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	activeStreak, err := queries.CalculateSubmissionActiveStreak(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, context.Background(), userId, string(SUBMISSION_ACTIVE_STREAK), activeStreak)
		if err != nil {
			log.Printf("Failed to save submission active streak: %v", err)
		}
	}()

	return activeStreak >= passingCount, nil
}

func CalculateSubmissionMaxStreak(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	maxStreak, err := queries.CalculateSubmissionMaxStreak(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, context.Background(), userId, string(SUBMISSION_STREAK), maxStreak)
		if err != nil {
			log.Printf("Failed to save submission active streak: %v", err)
		}
	}()

	return maxStreak >= passingCount, nil
}

func CalculateSubmissionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateSubmissionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, context.Background(), userId, string(SUBMISSION_TOTAL), count)
		if err != nil {
			log.Printf("Failed to save submission total: %v", err)
		}
	}()

	return count >= passingCount, nil
}

func CalculateReactionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, context.Background(), userId, string(REACTION_TOTAL), count)
		if err != nil {
			log.Printf("Failed to save reaction total: %v", err)
		}
	}()

	return count >= passingCount, nil
}

func CalculateReactionCommentTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionCommentCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, context.Background(), userId, string(REACTION_COMMENT_TOTAL), count)
		if err != nil {
			log.Printf("Failed to save reaction comment total: %v", err)
		}
	}()

	return count >= passingCount, nil
}

func CalculateReactionSubmissionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionSubmissionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, context.Background(), userId, string(REACTION_SUBMISSION_TOTAL), count)
		if err != nil {
			log.Printf("Failed to save reaction submission total: %v", err)
		}
	}()

	return count >= passingCount, nil
}

func CalculateCommentTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateCommentCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, context.Background(), userId, string(COMMENT_TOTAL), count)
		if err != nil {
			log.Printf("Failed to save comment total: %v", err)
		}
	}()

	return count >= passingCount, nil
}

func CalculateFriendTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateFriendCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, context.Background(), userId, string(FRIEND_TOTAL), count)
		if err != nil {
			log.Printf("Failed to save friend total: %v", err)
		}
	}()

	return count >= passingCount, nil
}
