package stats

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"log"

	"github.com/gin-gonic/gin"
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
	Ctx   *gin.Context
	Stats UserStats
}

type UserStats struct {
	SubmissionActiveStreak  int
	SubmissionMaxStreak     int
	SubmissionTotal         int
	CommentTotal            int
	ReactionTotal           int
	ReactionCommentTotal    int
	ReactionSubmissionTotal int
	FriendTotal             int
}

func NewStatsService(db *sql.DB, ctx *gin.Context, userId string) *StatsService {
	stats, err := GetUserStats(db, ctx.Request.Context(), userId, []string{
		string(SUBMISSION_ACTIVE_STREAK),
		string(SUBMISSION_STREAK),
		string(SUBMISSION_TOTAL),
		string(COMMENT_TOTAL),
		string(REACTION_TOTAL),
		string(REACTION_COMMENT_TOTAL),
		string(REACTION_SUBMISSION_TOTAL),
		string(FRIEND_TOTAL),
	})

	if err != nil {

	}

	return &StatsService{
		DB:    db,
		Ctx:   ctx,
		Stats: stats,
	}
}

func getAllCalculatedStats(repo *sql.DB, ctx context.Context, userId string, statTypes []string) (UserStats, error) {
	stats := UserStats{}
	calculatedStats, err := queries.GetCalculatedStats(repo, ctx, userId, statTypes)

	if err != nil {
		return stats, err
	}
	stats.SubmissionActiveStreak = calculatedStats[string(SUBMISSION_ACTIVE_STREAK)]
	stats.SubmissionMaxStreak = calculatedStats[string(SUBMISSION_STREAK)]
	stats.SubmissionTotal = calculatedStats[string(SUBMISSION_TOTAL)]
	stats.CommentTotal = calculatedStats[string(COMMENT_TOTAL)]
	stats.ReactionTotal = calculatedStats[string(REACTION_TOTAL)]
	stats.ReactionCommentTotal = calculatedStats[string(REACTION_COMMENT_TOTAL)]
	stats.ReactionSubmissionTotal = calculatedStats[string(REACTION_SUBMISSION_TOTAL)]
	stats.FriendTotal = calculatedStats[string(FRIEND_TOTAL)]

	return stats, nil
}

func (ss *StatsService) GetUserStats(userId string) (UserStats, error) {
	submissionStreak, err := GetOrCalculateSubmissionMaxStreak(ss.DB, ss.Ctx.Request.Context(), userId)

	if err != nil {
		log.Printf("Error calculating submission streak for user %s", userId)
	}

	submissionActiveStreak, err := GetOrCalculateSubmissionActiveStreak(ss.DB, ss.Ctx.Request.Context(), userId)

	if err != nil {
		log.Printf("Error calculating submission active streak for user %s", userId)
	}

	submissionTotal, err := GetOrCalculateSubmissionCount(ss.DB, ss.Ctx.Request.Context(), userId)

	if err != nil {
		log.Printf("Error calculating submission total for user %s", userId)
	}

	commentTotal, err := GetOrCalculateCommentCount(ss.DB, ss.Ctx.Request.Context(), userId)

	if err != nil {
		log.Printf("Error calculating comment total for user %s", userId)
	}

	reactionTotal, err := GetOrCalculateReactionCount(ss.DB, ss.Ctx.Request.Context(), userId)

	if err != nil {
		log.Printf("Error calculating reaction total for user %s", userId)
	}

	reactionCommentTotal, err := GetOrCalculateReactionCommentCount(ss.DB, ss.Ctx.Request.Context(), userId)

	if err != nil {
		log.Printf("Error calculating reaction comment total for user %s", userId)
	}

	reactionSubmissionTotal, err := GetOrCalculateReactionSubmissionCount(ss.DB, ss.Ctx.Request.Context(), userId)

	if err != nil {
		log.Printf("Error calculating reaction submission total for user %s", userId)
	}

	friendTotal, err := GetOrCalculateFriendCount(ss.DB, ss.Ctx.Request.Context(), userId)

	if err != nil {
		log.Printf("Error calculating friend total for user %s", userId)
	}

	stats := UserStats{
		SubmissionMaxStreak:     submissionStreak,
		SubmissionActiveStreak:  submissionActiveStreak,
		SubmissionTotal:         submissionTotal,
		CommentTotal:            commentTotal,
		ReactionTotal:           reactionTotal,
		ReactionCommentTotal:    reactionCommentTotal,
		ReactionSubmissionTotal: reactionSubmissionTotal,
		FriendTotal:             friendTotal,
	}

	return stats, nil
}

func CheckAchievementCondition(repo *sql.DB, ctx context.Context, userId string, achievement models.Achievement) (bool, error) {
	switch achievement.AchievementField {
	case string(SUBMISSION_ACTIVE_STREAK):
		return CheckSubmissionActiveStreak(repo, ctx, userId, achievement.AchievementValue)
	case string(SUBMISSION_STREAK):
		return CheckSubmissionStreak(repo, ctx, userId, achievement.AchievementValue)
	case string(SUBMISSION_TOTAL):
		return CheckSubmissionTotal(repo, ctx, userId, achievement.AchievementValue)
	case string(COMMENT_TOTAL):
		return CheckCommentTotal(repo, ctx, userId, achievement.AchievementValue)
	case string(REACTION_TOTAL):
		return CheckReactionTotal(repo, ctx, userId, achievement.AchievementValue)
	case string(REACTION_COMMENT_TOTAL):
		return CheckReactionCommentTotal(repo, ctx, userId, achievement.AchievementValue)
	case string(REACTION_SUBMISSION_TOTAL):
		return CheckReactionSubmissionTotal(repo, ctx, userId, achievement.AchievementValue)
	case string(FRIEND_TOTAL):
		return CheckFriendTotal(repo, ctx, userId, achievement.AchievementValue)
	default:
		log.Printf("No applicable condition for achievement %v", achievement)
	}

	return false, nil
}

func GetOrCalculateSubmissionActiveStreak(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	activeStreak, err := queries.CalculateSubmissionActiveStreak(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return activeStreak >= passingCount, nil
}

func GetOrCalculateSubmissionStreak(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	maxStreak, err := queries.CalculateSubmissionMaxStreak(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return maxStreak >= passingCount, nil
}

func GetOrCalculateSubmissionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateSubmissionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateReactionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateReactionCommentTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionCommentCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateReactionSubmissionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionSubmissionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateCommentTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateCommentCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateFriendTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateFriendCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

// YOYOYO
func GetOrCalculateSubmissionActiveStreak(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	activeStreak, err := queries.CalculateSubmissionActiveStreak(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return activeStreak >= passingCount, nil
}

func GetOrCalculateSubmissionStreak(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	maxStreak, err := queries.CalculateSubmissionMaxStreak(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return maxStreak >= passingCount, nil
}

func GetOrCalculateSubmissionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateSubmissionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateReactionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateReactionCommentTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionCommentCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateReactionSubmissionTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateReactionSubmissionCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateCommentTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateCommentCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

func GetOrCalculateFriendTotal(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	count, err := queries.CalculateFriendCount(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	return count >= passingCount, nil
}

// HERE
func CalculateSubmissionActiveStreak(repo *sql.DB, ctx context.Context, userId string, passingCount int) (bool, error) {
	activeStreak, err := queries.CalculateSubmissionActiveStreak(repo, ctx, userId)

	if err != nil {
		return false, err
	}

	go func() {
		err := queries.InsertCalculatedStat(repo, ctx, userId, string(SUBMISSION_ACTIVE_STREAK), activeStreak)
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
		err := queries.InsertCalculatedStat(repo, ctx, userId, string(SUBMISSION_STREAK), maxStreak)
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
		err := queries.InsertCalculatedStat(repo, ctx, userId, string(SUBMISSION_TOTAL), count)
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
		err := queries.InsertCalculatedStat(repo, ctx, userId, string(REACTION_TOTAL), count)
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
		err := queries.InsertCalculatedStat(repo, ctx, userId, string(REACTION_COMMENT_TOTAL), count)
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
		err := queries.InsertCalculatedStat(repo, ctx, userId, string(REACTION_SUBMISSION_TOTAL), count)
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
		err := queries.InsertCalculatedStat(repo, ctx, userId, string(COMMENT_TOTAL), count)
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
		err := queries.InsertCalculatedStat(repo, ctx, userId, string(FRIEND_TOTAL), count)
		if err != nil {
			log.Printf("Failed to save friend total: %v", err)
		}
	}()

	return count >= passingCount, nil
}
