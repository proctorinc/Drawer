/**
 * What one of your doodles earned, mirroring server/internal/xp/xp.go: the drawing
 * itself, plus a judge bonus for a score of 5 or more. Keep the two in step.
 */
const PER_DRAWING = 10;
const JUDGE_BOOST_MIN = 0.1;
const JUDGE_BOOST_MAX = 3;
/** One-decimal scores from 5.0 to 10.0 */
const JUDGE_SCORE_STEPS = 51;

export type DoodleXP = {
  drawing: number;
  /** Null when the judge scored under 5 */
  judge: { score: number; boost: number; xp: number } | null;
  total: number;
};

export function doodleXP(score: number | null | undefined): DoodleXP {
  const tenths = score == null ? -1 : Math.round(score * 10);
  const i = tenths - 50;
  if (i < 0 || i >= JUDGE_SCORE_STEPS) {
    return { drawing: PER_DRAWING, judge: null, total: PER_DRAWING };
  }
  const t = i / (JUDGE_SCORE_STEPS - 1);
  const boost = JUDGE_BOOST_MIN + (JUDGE_BOOST_MAX - JUDGE_BOOST_MIN) * t ** 3;
  const xp = Math.round(PER_DRAWING * boost);
  return {
    drawing: PER_DRAWING,
    judge: { score: tenths / 10, boost, xp },
    total: PER_DRAWING + xp,
  };
}
