package stats

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
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
)

type StatsService struct {
	DB    *sql.DB
	Ctx   context.Context
	Stats UserStats
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
	default:
		log.Printf("No applicable condition for achievement %v", achievement)
	}

	return count, count >= achievement.AchievementValue, nil
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
