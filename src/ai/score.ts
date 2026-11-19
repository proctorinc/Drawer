/** Every AI score is out of this */
export const AI_SCORE_MAX = 10;

/** A score with at most one decimal place: 7, 7.3 (never 7.0 or 7.33) */
export const formatScore = (score: number) =>
  String(Math.round(score * 10) / 10);
