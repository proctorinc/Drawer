/** Every AI score is out of this */
export const AI_SCORE_MAX = 10;

/** A score with at most one decimal place: 7, 7.3 (never 7.0 or 7.33) */
export const formatScore = (score: number) =>
  String(Math.round(score * 10) / 10);

/**
 * What a review's score is worth in XP: the score, or for a judge that scores
 * backwards (the Grinch), how mad he got (10 minus his approval). Mirrors
 * judgedScore in server/internal/db/queries/trophies.queries.go.
 */
export const xpScore = (score: number, scoresBackwards?: boolean) =>
  scoresBackwards ? Math.round((AI_SCORE_MAX - score) * 10) / 10 : score;
