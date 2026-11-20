// Package xp scores activity as XP and XP as levels. XP is computed from existing
// activity rather than stored, so changing these values re-scores everyone's history.
package xp

import (
	"drawer-service-backend/internal/db/queries"
	"math"
)

const (
	PerDrawing          = 10
	PerCommentWritten   = 3
	PerReactionGiven    = 2
	PerReactionReceived = 1
	PerAchievement      = 25
	// Going from level n to n+1 costs n * PerLevelStep
	PerLevelStep = 50
	// A doodle the AI judge scores 5 or more earns its drawing XP again times a boost
	// that starts small and climbs steeply: x0.1 at 5, x0.3 at 7, x1.6 at 9, x3 at 10.
	// So a 10 is worth four doodles' XP, and almost all of that comes from the last point.
	JudgeBoostMin = 0.1
	JudgeBoostMax = 3.0
)

// JudgeBonus is the extra XP for a doodle the judge scored at JudgeScores index i
// (5.0 plus i tenths): 1 XP at 5, 3 at 7, 7 at 8, 16 at 9, 30 at 10.
func JudgeBonus(i int) int {
	t := float64(i) / float64(queries.JudgeScoreSteps-1)
	boost := JudgeBoostMin + (JudgeBoostMax-JudgeBoostMin)*t*t*t
	return int(math.Round(PerDrawing * boost))
}

// For is the XP someone's activity is worth
func For(a queries.ActivityCounts) int {
	return a.Drawings*PerDrawing +
		a.CommentsWritten*PerCommentWritten +
		a.ReactionsGiven*PerReactionGiven +
		a.ReactionsReceived*PerReactionReceived +
		a.Achievements*PerAchievement +
		judgeXP(a.JudgeScores)
}

func judgeXP(scores [queries.JudgeScoreSteps]int) int {
	total := 0
	for i, n := range scores {
		total += n * JudgeBonus(i)
	}
	return total
}

type Level struct {
	Level int `json:"level"`
	XP    int `json:"xp"`
	// XP at which the current level started and the next one begins
	LevelStartXP int `json:"levelStartXp"`
	NextLevelXP  int `json:"nextLevelXp"`
}

// LevelFor is the level an amount of XP reaches
func LevelFor(xp int) Level {
	level, start := 1, 0
	for {
		next := start + level*PerLevelStep
		if xp < next {
			return Level{Level: level, XP: xp, LevelStartXP: start, NextLevelXP: next}
		}
		level, start = level+1, next
	}
}
