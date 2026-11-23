package ai

import (
	"drawer-service-backend/internal/db/models"
	"strings"
)

// isChristmasEve reports whether day (YYYY-MM-DD) is Christmas Eve.
func isChristmasEve(day string) bool {
	return strings.HasSuffix(day, "-12-24")
}

// introOccasion tells a judge writing its intro what's special about day, or "" on an
// ordinary one. On Christmas Eve, the Grinch makes a big deal of it: it's his last chance.
func introOccasion(p models.AIPersonality, day string) string {
	if !isChristmasEve(day) {
		return ""
	}
	if p.ScoresBackwards {
		return "\n\nToday is Christmas Eve, the very day before Christmas. Make a big deal of it in your opening: it's your last, best chance to ruin Christmas before morning, so this plot matters more than any before it."
	}
	return "\n\nToday is Christmas Eve, the day before Christmas. Work that into your lines."
}

// commentOccasion is the same for a judge's comment on a doodle drawn on day.
func commentOccasion(backwards bool, day string) string {
	if !isChristmasEve(day) {
		return ""
	}
	if backwards {
		return " It's Christmas Eve, the day before Christmas, your last chance to ruin it before morning: work that in."
	}
	return " It's Christmas Eve, the day before Christmas: you may work that in."
}
