import type { LevelSnapshot } from '../types';

/** One level's worth of bar filling */
type Segment = {
  level: number;
  /** Bar fraction (0–1) this segment starts and ends at */
  start: number;
  end: number;
  /** When it plays, in ms from the start of the fill */
  t0: number;
  t1: number;
};

export type FillPlan = { segments: Array<Segment>; duration: number };

export type FillFrame = {
  level: number;
  /** Bar fraction, 0–1 */
  frac: number;
  /** 0–1 through the whole fill, eased, for counting the XP up */
  progress: number;
};

/** How long the bar sits full before rolling over (shorter for big jumps) */
export const ROLLOVER_PAUSE_MS = 140;

export function levelFraction(snapshot: LevelSnapshot): number {
  const span = snapshot.nextLevelXp - snapshot.levelStartXp;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (snapshot.xp - snapshot.levelStartXp) / span));
}

const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;
const easeInOutSine = (u: number) => -(Math.cos(Math.PI * u) - 1) / 2;

/**
 * Lays out the bar's journey from one snapshot to another: fill the current
 * level, pause full, reset, fill the next, and so on. A single level gets a
 * relaxed ~0.9s; several share a budget so big jumps don't drag on.
 */
export function buildFillPlan(
  from: LevelSnapshot,
  to: LevelSnapshot,
): FillPlan {
  const levels = Math.max(0, to.level - from.level);
  const startFrac = levelFraction(from);
  const endFrac = levelFraction(to);

  const ranges: Array<{ level: number; start: number; end: number }> = [];
  if (levels === 0) {
    ranges.push({
      level: to.level,
      start: Math.min(startFrac, endFrac),
      end: endFrac,
    });
  } else {
    ranges.push({ level: from.level, start: startFrac, end: 1 });
    for (let level = from.level + 1; level < to.level; level++) {
      ranges.push({ level, start: 0, end: 1 });
    }
    ranges.push({ level: to.level, start: 0, end: endFrac });
  }

  // A full level's fill time, shrinking as more levels share the budget
  const perLevel = Math.max(120, Math.min(900, 1500 / (levels + 1)));
  // Big jumps flip through levels quickly
  const pause = levels > 3 ? 60 : ROLLOVER_PAUSE_MS;
  const segments: Array<Segment> = [];
  let t = 0;
  ranges.forEach((range, i) => {
    const moves = range.end > range.start;
    // A lone small gain still gets a visible sweep
    const floor = !moves ? 0 : ranges.length === 1 ? 500 : 120;
    const length = Math.max(floor, (range.end - range.start) * perLevel);
    segments.push({ ...range, t0: t, t1: t + length });
    t += length;
    if (i < ranges.length - 1) t += pause;
  });
  return { segments, duration: t };
}

export function sampleFill(plan: FillPlan, t: number): FillFrame {
  const { segments, duration } = plan;
  const progress = duration > 0 ? easeOutCubic(clamp01(t / duration)) : 1;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const last = i === segments.length - 1;
    if (t < seg.t0) {
      return { level: seg.level, frac: seg.start, progress };
    }
    if (t <= seg.t1 || last) {
      const span = seg.t1 - seg.t0;
      const u = span > 0 ? clamp01((t - seg.t0) / span) : 1;
      const eased = last ? easeOutCubic(u) : easeInOutSine(u);
      return {
        level: seg.level,
        frac: seg.start + (seg.end - seg.start) * eased,
        progress,
      };
    }
    // In the pause after this segment: hold it full
    if (t < segments[i + 1].t0) {
      return { level: seg.level, frac: seg.end, progress };
    }
  }
  const final = segments[segments.length - 1];
  return { level: final.level, frac: final.end, progress: 1 };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
