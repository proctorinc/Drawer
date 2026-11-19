package handlers

import (
	"drawer-service-backend/internal/db/queries"
	"testing"
)

func TestProgressionStats(t *testing.T) {
	lifetime := map[string]queries.ActivityCounts{
		"new":  {},              // 0 XP: level 1
		"some": {Drawings: 5},   // 50 XP: level 2
		"lots": {Drawings: 100}, // 1000 XP: level 6
	}
	weekly := map[string]queries.ActivityCounts{
		"some": {Drawings: 5, CommentsWritten: 1},
		"lots": {Drawings: 2},
	}

	levels, quests := progressionStats(lifetime, weekly)

	if len(levels) != minLevelsShown {
		t.Fatalf("got %d levels, want %d", len(levels), minLevelsShown)
	}
	for level, want := range map[int]int{1: 1, 2: 1, 6: 1, 3: 0} {
		if got := levels[level-1].Players; got != want {
			t.Errorf("level %d has %d players, want %d", level, got, want)
		}
	}

	draw5, comment3 := quests[0], quests[2]
	if draw5.ID != "draw-5" || draw5.Started != 2 || draw5.Completed != 1 {
		t.Errorf("draw-5 = %+v, want 2 started and 1 completed", draw5)
	}
	if comment3.Started != 1 || comment3.Completed != 0 {
		t.Errorf("comment-3 = %+v, want 1 started and none completed", comment3)
	}
}
