import type { AICriterionScore, User } from '@/api/Api';
import { AI_SCORE_MAX } from '@/ai/score';

/**
 * Minted polaroids, preview only: nothing here is signed or saved yet. It works
 * out what a pinned doodle's card would be from its AI review, so the admin
 * preview page can show the tiers, condition, rarity and the judge's signature
 * on real doodles before the server mints anything.
 */

export type TierId =
  | 'misprint'
  | 'common'
  | 'uncommon'
  | 'silver'
  | 'gold'
  | 'holo';

export interface Tier {
  id: TierId;
  name: string;
  /** The lowest score that reaches it */
  min: number;
  pips: string;
  /** Ink for the tier's stats */
  accent: string;
}

/** Lowest to highest. A 1.5 or under is a misprint: rare, the weird way */
export const TIERS: Array<Tier> = [
  { id: 'misprint', name: 'Misprint', min: 0, pips: '?', accent: '#e5483b' },
  { id: 'common', name: 'Common', min: 1.6, pips: '●', accent: '#2b2a33' },
  { id: 'uncommon', name: 'Uncommon', min: 5, pips: '●●', accent: '#3f9c6b' },
  { id: 'silver', name: 'Silver', min: 8, pips: '●●●', accent: '#66789a' },
  { id: 'gold', name: 'Gold', min: 9, pips: '●●●●', accent: '#d99100' },
  {
    id: 'holo',
    name: 'Holo',
    min: AI_SCORE_MAX,
    pips: '●●●●●',
    accent: '#8a5cf5',
  },
];

export const tierFor = (score: number): Tier =>
  [...TIERS].reverse().find((tier) => score >= tier.min - 1e-9) ?? TIERS[1];

/* ---------- condition: how well it printed ---------- */

export interface Condition {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
  overall: number;
}

export const GRADE_NAMES: Record<number, string> = {
  10: 'Gem Mint',
  9: 'Mint',
  8: 'Near Mint',
  7: 'Excellent',
  6: 'Very Good',
  5: 'Good',
  4: 'Fair',
};
export const GRADES = [10, 9, 8, 7, 6, 5, 4] as const;

// How often each sub-grade comes up, out of 256 (one byte of the roll)
const SUB_WEIGHTS: Record<number, number> = {
  10: 8,
  9: 33,
  8: 59,
  7: 68,
  6: 52,
  5: 25,
  4: 11,
};

const gradeFrom = (byte: number) => {
  let left = byte;
  for (const grade of GRADES) {
    left -= SUB_WEIGHTS[grade];
    if (left < 0) return grade;
  }
  return 4;
};

/** The rounded average, never more than one above the worst sub-grade */
export const overallOf = (c: Omit<Condition, 'overall'>) => {
  const all = [c.centering, c.corners, c.edges, c.surface];
  const average = Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  return Math.min(average, Math.min(...all) + 1);
};

/** How likely each overall grade is */
export const GRADE_ODDS: Record<number, number> = (() => {
  const odds: Record<number, number> = {};
  for (const a of GRADES)
    for (const b of GRADES)
      for (const c of GRADES)
        for (const d of GRADES) {
          const grade = overallOf({
            centering: a,
            corners: b,
            edges: c,
            surface: d,
          });
          odds[grade] =
            (odds[grade] ?? 0) +
            (SUB_WEIGHTS[a] *
              SUB_WEIGHTS[b] *
              SUB_WEIGHTS[c] *
              SUB_WEIGHTS[d]) /
              256 ** 4;
        }
  return odds;
})();

// Four steady bytes from a string. The server would roll these from its secret
// key instead, so nobody could predict them
const bytesOf = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: Array<number> = [];
  for (let i = 0; i < 4; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push((h >>> 0) & 255);
  }
  return out;
};

/** A preview roll: steady for a doodle, but not the real (secret) roll */
export const previewCondition = (submissionId: string): Condition => {
  const [a, b, c, d] = bytesOf(`condition|${submissionId}`);
  const grades = {
    centering: gradeFrom(a),
    corners: gradeFrom(b),
    edges: gradeFrom(c),
    surface: gradeFrom(d),
  };
  return { ...grades, overall: overallOf(grades) };
};

/* ---------- the judge's mood and signature ---------- */

export type Mood = 'none' | 'love' | 'hate';
export const moodOf = (swingPoints?: number): Mood =>
  !swingPoints ? 'none' : swingPoints > 0 ? 'love' : 'hate';
const MOOD_ODDS: Record<Mood, number> = { none: 0.94, love: 0.03, hate: 0.03 };

export interface Signature {
  text: string;
  font: string;
  ink: string;
  /** Font size as a share of the card's width, since the faces differ in height */
  scale: number;
}

const SIGNATURE_STYLES = [
  { font: "'Homemade Apple', cursive", scale: 0.066 },
  { font: "'Mrs Saint Delafield', cursive", scale: 0.1 },
  { font: "'La Belle Aurore', cursive", scale: 0.076 },
  { font: "'Reenie Beanie', cursive", scale: 0.09 },
  { font: "'Sacramento', cursive", scale: 0.088 },
];
const SIGNATURE_INKS = ['#2c4fa3', '#2f7aa6', '#6b3fa0', '#1f6b4a', '#a2372b'];

/** The fonts every judge's signature is drawn from */
export const SIGNATURE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Homemade+Apple&family=La+Belle+Aurore&family=Mrs+Saint+Delafield&family=Reenie+Beanie&family=Sacramento&display=swap';

/**
 * Each judge signs the same way every time: a hand and an ink picked from
 * their id. A real signature (drawn by an admin, saved on the personality)
 * would replace this.
 */
export const signatureFor = (judge: {
  id: string;
  name: string;
}): Signature => {
  const [a, b] = bytesOf(`signature|${judge.id}`);
  const style = SIGNATURE_STYLES[a % SIGNATURE_STYLES.length];
  return {
    text: judge.name.replace(/^(judge|the)\s+/i, ''),
    font: style.font,
    ink: SIGNATURE_INKS[b % SIGNATURE_INKS.length],
    scale: style.scale,
  };
};

/* ---------- the cards ---------- */

/** One judged doodle, as the AI log has it */
export interface MintSource {
  submissionId: string;
  imageUrl: string;
  prompt: string;
  user: User;
  judge: { id: string; name: string; avatarUrl: string; decoration: string };
  systemPrompt: string;
  model: string;
  score: number;
  criteria: Array<AICriterionScore>;
  comment: string;
  durationMs: number;
  reviewedAt: string;
  metadata: {
    seen?: string;
    effort?: string;
    effortPenalty?: number;
    prompt?: string;
    promptMissing?: string;
    promptBonus?: number;
    swing?: string;
    swingPoints?: number;
  };
}

export interface Rarity {
  odds: number;
  rank: string;
}

export interface MintCard {
  id: string;
  source: MintSource;
  day: string;
  /** e.g. "Nov '26" */
  set: string;
  /** Its place in the day's order */
  serial: number;
  tier: Tier;
  cond: Condition;
  mood: Mood;
  rarity: Rarity;
  signature: Signature;
  ver: number;
  fmt: number;
}

export interface PopNumbers {
  tier: number;
  grade: number;
  both: number;
  higher: number;
}

export interface Population {
  total: number;
  byTier: Record<TierId, number>;
  byGrade: Record<number, number>;
  count: (tier: TierId, grade: number) => number;
  of: (card: MintCard) => PopNumbers;
}

const RANKS: Array<[number, string]> = [
  [20, 'Common'],
  [200, 'Uncommon'],
  [2000, 'Rare'],
  [20000, 'Very rare'],
  [200000, 'Ultra rare'],
  [Infinity, 'One in a million'],
];

const setName = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  return `${date.toLocaleDateString('en-US', { month: 'short' })} '${String(date.getFullYear()).slice(2)}`;
};

/**
 * Every judged doodle's card, with live counts of how many share each tier
 * and grade. Rarity weighs how often each tier really comes up here, the
 * grade's odds, the judge's mood and being first pin of the day.
 */
export function buildCards(sources: Array<MintSource>): {
  cards: Array<MintCard>;
  population: Population;
} {
  // Serial numbers follow the order doodles were judged each day
  const byDay = new Map<string, Array<MintSource>>();
  for (const source of sources) {
    const day = source.reviewedAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), source]);
  }
  const serials = new Map<string, number>();
  for (const list of byDay.values()) {
    [...list]
      .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
      .forEach((source, i) => serials.set(source.submissionId, i + 1));
  }

  const drafts = sources.map((source) => {
    const day = source.reviewedAt.slice(0, 10);
    return {
      id: source.submissionId,
      source,
      day,
      set: setName(day),
      serial: serials.get(source.submissionId) ?? 1,
      tier: tierFor(source.score),
      cond: previewCondition(source.submissionId),
      mood: moodOf(source.metadata.swingPoints),
      signature: signatureFor(source.judge),
      ver: 1,
      fmt: 2,
    };
  });

  const byTier = Object.fromEntries(TIERS.map((t) => [t.id, 0])) as Record<
    TierId,
    number
  >;
  const byGrade: Record<number, number> = Object.fromEntries(
    GRADES.map((g) => [g, 0]),
  );
  const both = new Map<string, number>();
  for (const draft of drafts) {
    byTier[draft.tier.id] += 1;
    byGrade[draft.cond.overall] += 1;
    const key = `${draft.tier.id}|${draft.cond.overall}`;
    both.set(key, (both.get(key) ?? 0) + 1);
  }
  const total = drafts.length;
  const count = (tier: TierId, grade: number) =>
    both.get(`${tier}|${grade}`) ?? 0;

  const cards = drafts.map((draft): MintCard => {
    const tierOdds = Math.max(byTier[draft.tier.id], 1) / Math.max(total, 1);
    const odds =
      1 /
      (tierOdds *
        (GRADE_ODDS[draft.cond.overall] ?? 1) *
        MOOD_ODDS[draft.mood] *
        (draft.serial === 1
          ? 1 / Math.max(byDay.get(draft.day)?.length ?? 1, 1)
          : 1));
    const rank = RANKS.find(([below]) => odds < below)?.[1] ?? 'Common';
    return { ...draft, rarity: { odds, rank } };
  });

  const population: Population = {
    total,
    byTier,
    byGrade,
    count,
    of: (card) => ({
      tier: byTier[card.tier.id],
      grade: byGrade[card.cond.overall],
      both: count(card.tier.id, card.cond.overall),
      higher: GRADES.filter((g) => g > card.cond.overall).reduce(
        (sum, g) => sum + count(card.tier.id, g),
        0,
      ),
    }),
  };
  return { cards, population };
}

/** "48K", "1.2M", "640" */
export const compactOdds = (odds: number) =>
  odds >= 1e6
    ? `${(odds / 1e6).toFixed(1)}M`
    : odds >= 1e4
      ? `${Math.round(odds / 1e3)}K`
      : odds >= 1e3
        ? `${(odds / 1e3).toFixed(1)}K`
        : String(Math.max(1, Math.round(odds)));

/* ---------- the token's payload ---------- */

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
};

/**
 * Everything the card would sign: the doodle, its maker, and every detail of
 * the AI review we have. Fields Drawer doesn't record yet are null, so the
 * gaps show.
 */
export async function payloadFor(
  card: MintCard,
): Promise<Record<string, unknown>> {
  const s = card.source;
  const criteria = await Promise.all(
    s.criteria.map(async (c) => ({
      id: c.id,
      name: c.name,
      description_sha256: (await sha256(c.description)).slice(0, 16),
      score: c.score,
    })),
  );
  return {
    fmt: card.fmt,
    ver: card.ver,
    prev: null,
    reason: 'Pinned',
    sub: card.id,
    set: card.set,
    serial: card.serial,
    maker: { id: s.user.id, name: s.user.username },
    prompt: s.prompt,
    day: card.day,
    minted_at: null,
    img: { url: s.imageUrl, sha256: null },
    judge: {
      id: s.judge.id,
      name: s.judge.name,
      avatar_url: s.judge.avatarUrl,
      decoration: s.judge.decoration,
      signature: { font: card.signature.font, ink: card.signature.ink },
      personality_rev: null,
      system_prompt_sha256: (await sha256(s.systemPrompt)).slice(0, 16),
      system_prompt_chars: s.systemPrompt.length,
      rubric_rev: null,
      criteria,
      score_max: AI_SCORE_MAX,
      provider: 'openai',
      model: s.model,
      model_snapshot: null,
      params: null,
      request: {
        id: null,
        response_id: null,
        attempts: null,
        started_at: null,
        finished_at: s.reviewedAt,
        duration_ms: s.durationMs,
      },
      usage: null,
      finish_reason: null,
    },
    verdict: {
      seen: s.metadata.seen ?? null,
      effort: s.metadata.effort ?? null,
      effort_penalty: s.metadata.effortPenalty ?? null,
      prompt: s.metadata.prompt ?? null,
      prompt_missing: s.metadata.promptMissing ?? null,
      prompt_bonus: s.metadata.promptBonus ?? null,
      swing: s.metadata.swing
        ? { kind: s.metadata.swing, points: s.metadata.swingPoints ?? 0 }
        : null,
      raw_score: null,
      score: s.score,
    },
    comment: {
      sha256: (await sha256(s.comment)).slice(0, 16),
      chars: s.comment.length,
      words: s.comment.trim() ? s.comment.trim().split(/\s+/).length : 0,
    },
    cond: card.cond,
    tier: card.tier.id,
  };
}

/** What the server would need to start recording before minting is real */
export const NOT_TRACKED_YET = [
  'image hash',
  'personality and rubric revisions',
  'model snapshot',
  'temperature and other parameters',
  'request and response ids',
  'attempts',
  'token usage and cost',
  'finish reason',
  'score before adjustments',
];
