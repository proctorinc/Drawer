package queries

// A user's stats_start_day restarts their progress: activity from before it, a date on
// the server's clock, earns no XP and counts toward no level, streak, quest or
// achievement. Their drawings, comments and reactions all stay; they just don't count.
// Most users have none, so everything they've done counts.

// countedDay is a SQL condition that dayExpr, a server-clock date, falls on or after
// the stats start day of the user in userCol
func countedDay(userCol, dayExpr string) string {
	return dayExpr + ` >= COALESCE((SELECT stats_start_day FROM users WHERE users.id = ` + userCol + `), '')`
}

// countedAt is countedDay for atCol, a UTC timestamp such as created_at
func countedAt(userCol, atCol string) string {
	return countedDay(userCol, `date(`+atCol+`, '`+weekModifier()+`')`)
}
