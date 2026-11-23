import { Link } from '@tanstack/react-router';
import { describeSwing } from '../api';
import { Tag } from './ui';
import type { AICall, AIRun, AIScoreBreakdown, AISwingRoll } from '../api';
import type { FC, ReactNode } from 'react';
import { AI_SCORE_MAX, formatScore } from '@/ai/score';
import { cn } from '@/utils';

// Everything about one judge run: what it saw, the dice, and the math from its answer to
// the final score. The AI log and the testing ground both show runs with this, so they
// always match.

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** "+1.5", "−3", "±0" */
const signed = (n: number) =>
  n > 0 ? `+${formatScore(n)}` : n < 0 ? `−${formatScore(-n)}` : '±0';

const percent = (share: number) => `${Math.round(share * 100)}%`;

const PROMPT_LABELS = {
  nailed: 'nailed the prompt',
  complete: 'got the whole prompt',
  partial: 'missed part of the prompt',
  missed: 'missed most of the prompt',
} as const;

const EFFORT_LABELS = {
  real: 'a real attempt',
  low: 'low effort',
  none: 'no effort',
} as const;

const Block: FC<{ title: string; aside?: ReactNode; children: ReactNode }> = ({
  title,
  aside,
  children,
}) => (
  <div className="flex flex-col gap-1 min-w-0">
    <div className="flex items-baseline gap-2">
      <span className="font-bold">{title}</span>
      {aside && <span className="text-sm text-pencil">{aside}</span>}
    </div>
    {children}
  </div>
);

const Pre: FC<{ children: ReactNode }> = ({ children }) => (
  <pre className="mt-1 p-3 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs bg-white border-[1.5px] border-line rounded">
    {children}
  </pre>
);

const Fold: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <details className="group">
    <summary className="cursor-pointer font-bold select-none">{title}</summary>
    {children}
  </details>
);

/** The judge's answer, indented when it's JSON */
const prettyAnswer = (answer: string) => {
  try {
    return JSON.stringify(JSON.parse(answer), null, 2);
  } catch {
    return answer;
  }
};

// --- The math ---

const cell = 'px-2 py-1 text-right tabular-nums whitespace-nowrap';
const headCell =
  'px-2 py-1 text-right font-normal text-pencil whitespace-nowrap';

/** One row: what the judge gave, fitted to 1..10, then each adjustment, then the score */
const MathRow: FC<{
  label: ReactNode;
  given: ReactNode;
  fitted: number;
  bonus: number;
  swing: number;
  score: number;
  muted?: boolean;
}> = ({ label, given, fitted, bonus, swing, score, muted }) => {
  // A score that moved past 0 or 10 stops there
  const capped =
    Math.round((fitted + bonus + swing) * 10) / 10 !== score && !muted;
  return (
    <tr className={cn('border-t border-line', muted && 'text-pencil')}>
      <td className="px-2 py-1 text-left">{label}</td>
      <td className={cell}>{given}</td>
      <td className={cell}>{formatScore(fitted)}</td>
      <td className={cell}>{signed(bonus)}</td>
      <td className={cell}>{signed(swing)}</td>
      <td className={cn(cell, 'font-bold')}>
        {muted ? '–' : formatScore(score)}
        {capped && <span className="font-normal text-pencil"> (capped)</span>}
      </td>
    </tr>
  );
};

const ScoreMath: FC<{
  run: AIRun;
  breakdown: AIScoreBreakdown;
  bonus: number;
  swing: number;
}> = ({ run, breakdown: b, bonus, swing }) => {
  const m = run.metadata;
  const criteria = b.criteria ?? [];
  const penalty = m.effortPenalty ?? 0;

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse">
        <thead>
          <tr>
            <th className={cn(headCell, 'text-left')}></th>
            <th className={headCell}>judge gave</th>
            <th className={headCell}>fitted 1–{AI_SCORE_MAX}</th>
            <th className={headCell}>prompt</th>
            <th className={headCell}>swing</th>
            <th className={headCell}>score</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <MathRow
              key={c.id}
              label={c.name || c.id}
              given={
                c.skipped ? (
                  <span className="text-coral">skipped → 5</span>
                ) : (
                  formatScore(c.given)
                )
              }
              fitted={c.fitted}
              bonus={bonus}
              swing={swing}
              score={c.score}
            />
          ))}
          <MathRow
            label={criteria.length ? 'overall (ignored)' : 'overall'}
            given={formatScore(b.givenScore)}
            fitted={b.fittedScore}
            bonus={bonus}
            swing={swing}
            score={b.beforeEffort}
            muted={criteria.length > 0}
          />
          {criteria.length > 0 && (
            <tr className="border-t border-line">
              <td className="px-2 py-1 text-left" colSpan={5}>
                average of {criteria.length}
              </td>
              <td className={cn(cell, 'font-bold')}>
                {formatScore(b.beforeEffort)}
              </td>
            </tr>
          )}
          {penalty > 0 && (
            <tr className="border-t border-line">
              <td className="px-2 py-1 text-left" colSpan={5}>
                {EFFORT_LABELS[m.effort ?? 'low']}: −{percent(penalty)} of{' '}
                {formatScore(b.beforeEffort)}
              </td>
              <td className={cn(cell, 'font-bold')}>
                {run.score !== null ? formatScore(run.score) : '–'}
              </td>
            </tr>
          )}
          <tr className="border-t-2 border-ink">
            <td className="px-2 py-1 text-left font-bold" colSpan={5}>
              final score
            </td>
            <td className={cn(cell, 'font-accent font-bold text-lg')}>
              {run.score !== null
                ? `${formatScore(run.score)}/${AI_SCORE_MAX}`
                : '–'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

/** For runs logged before the math was kept: just what was added or taken off */
const Adjustments: FC<{ run: AIRun }> = ({ run }) => {
  const m = run.metadata;
  const parts: Array<string> = [];
  if (m.promptBonus) parts.push(`prompt ${signed(m.promptBonus)} each`);
  if (m.swing && m.swingPoints)
    parts.push(`swing ${signed(m.swingPoints)} each`);
  if (m.effortPenalty)
    parts.push(`${m.effort} effort −${percent(m.effortPenalty)} overall`);
  return (
    <p className="text-sm text-pencil">
      {parts.length ? parts.join(' · ') : 'no adjustments'}. The judge's own
      scores weren't kept for runs this old.
    </p>
  );
};

/** What the judge said would have raised each score */
const Improvements: FC<{ breakdown: AIScoreBreakdown }> = ({
  breakdown: b,
}) => {
  const rows = (b.criteria ?? [])
    .filter((c) => c.improve)
    .map((c) => ({ key: c.id, label: c.name || c.id, text: c.improve }));
  if (b.improve)
    rows.push({ key: 'overall', label: 'overall', text: b.improve });
  if (!rows.length) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {rows.map((row) => (
        <li key={row.key}>
          <span className="font-bold">{row.label}:</span> {row.text}
        </li>
      ))}
    </ul>
  );
};

// --- The dice ---

const SwingDice: FC<{ roll: AISwingRoll }> = ({ roll }) => {
  const { kind, points } = rolledSwing(roll);
  // Each tier owns a slice of 0..100, rarest first; the rest is no swing
  let from = 0;
  const slices = roll.tiers.map((tier) => {
    const slice = { ...tier, from, to: from + tier.chance };
    from = slice.to;
    return slice;
  });
  const landed = slices.find((s) => s.kind === kind);
  const pct = (n: number) => (n * 100).toFixed(2);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div>
        rolled <b className="tabular-nums">{pct(roll.roll)}</b> out of 100
      </div>
      <ul className="flex flex-col gap-0.5">
        {[
          ...slices.map((s) => ({
            key: s.kind,
            label: `${s.kind === 'super' ? 'super boost' : 'boost'} ±${formatScore(s.min)}–${formatScore(s.max)}`,
            odds: `1 in ${Math.round(1 / s.chance)}`,
            range: `${pct(s.from)}–${pct(s.to)}`,
            hit: s.kind === kind,
          })),
          {
            key: 'none',
            label: 'no swing',
            odds: `${percent(1 - from)}`,
            range: `${pct(from)}–100`,
            hit: !kind,
          },
        ].map((row) => (
          <li
            key={row.key}
            className={cn(
              'flex gap-2 items-baseline',
              row.hit ? 'font-bold' : 'text-pencil',
            )}
          >
            <span className="w-4">{row.hit ? '→' : ''}</span>
            <span className="w-36">{row.label}</span>
            <span className="w-20">{row.odds}</span>
            <span className="tabular-nums">{row.range}</span>
          </li>
        ))}
      </ul>
      {landed && (
        <>
          <div>
            size roll <b className="tabular-nums">{roll.size.toFixed(2)}</b>:{' '}
            {formatScore(landed.min)} + {roll.size.toFixed(2)} × (
            {formatScore(landed.max)} − {formatScore(landed.min)}) ={' '}
            <b>{formatScore(Math.abs(points))}</b>
          </div>
          <div>
            coin flip: <b>{roll.hates ? 'hates it' : 'loves it'}</b>, so{' '}
            <b>{signed(points)}</b> to every score
          </div>
        </>
      )}
    </div>
  );
};

// --- The calls ---

const STEP_LABELS = {
  evaluate: 'evaluate: reads the doodle and scores it',
  comment: 'comment: writes it in character',
} as const;

/** The schema, indented */
const prettySchema = (schema: unknown) => JSON.stringify(schema, null, 2);

/** One call to the model, everything that went in and came back */
const CallDetails: FC<{ call: AICall; index: number }> = ({ call, index }) => (
  <div className="flex flex-col gap-1.5 min-w-0 pl-3 border-l-2 border-line">
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-bold">
        {index + 1}. {STEP_LABELS[call.step]}
      </span>
      <span className="text-sm text-pencil">
        took {seconds(call.durationMs)}
        {call.image &&
          ` · with the doodle${call.detail ? ` (${call.detail} detail)` : ''}`}
        {call.temperature !== undefined && ` · temperature ${call.temperature}`}
      </span>
    </div>
    {call.error && <p className="text-sm text-coral">{call.error}</p>}
    <Fold title="message">
      <Pre>{call.message}</Pre>
    </Fold>
    <Fold title="answer, as it came back">
      <Pre>{call.answer ? prettyAnswer(call.answer) : '–'}</Pre>
    </Fold>
    <Fold title="system prompt">
      <Pre>{call.system}</Pre>
    </Fold>
    {call.schema !== undefined && (
      <Fold title="answer schema">
        <Pre>{prettySchema(call.schema)}</Pre>
      </Fold>
    )}
  </div>
);

// --- The whole thing ---

export const AIRunBreakdown: FC<{
  run: AIRun;
  /** Hide the comment, when it's already shown above */
  hideComment?: boolean;
}> = ({ run, hideComment }) => {
  const m = run.metadata;
  const b = m.breakdown;
  const failed = run.status === 'failed';
  const bonus = m.promptBonus ?? 0;
  const swing = m.swingPoints ?? 0;
  // A run whose comment failed still has its evaluation
  const evaluated = !failed || !!m.seen;
  const calls = m.calls ?? [];

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {failed ? (
        <p className="text-coral">{run.error || 'failed'}</p>
      ) : (
        !hideComment && run.comment && <p>“{run.comment}”</p>
      )}

      {evaluated && (
        <Block title="what the judge saw">
          {m.seen ? (
            <p>“{m.seen}”</p>
          ) : (
            <p className="text-pencil">not kept for this run</p>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            {m.prompt && (
              <Tag
                className={
                  bonus > 0 ? 'bg-butter' : bonus < 0 ? 'bg-blush' : 'bg-white'
                }
              >
                {PROMPT_LABELS[m.prompt]} <b>{signed(bonus)}</b> each
              </Tag>
            )}
            {m.effort && (
              <Tag className={m.effortPenalty ? 'bg-blush' : 'bg-white'}>
                {EFFORT_LABELS[m.effort]}
                {!!m.effortPenalty && (
                  <>
                    {' '}
                    <b>−{percent(m.effortPenalty)}</b> overall
                  </>
                )}
              </Tag>
            )}
            {m.swing && (
              <Tag className={swing > 0 ? 'bg-butter' : 'bg-blush'}>
                {swing > 0 ? 'loved it' : 'hated it'}:{' '}
                <b>{describeSwing(m.swing, swing)}</b> each
              </Tag>
            )}
          </div>
          {m.idea && (
            <p className="text-sm">
              <span className="text-pencil">the artist's idea:</span> {m.idea}
            </p>
          )}
          {m.promptMissing && (
            <p className="text-sm">
              <span className="text-pencil">missing from the prompt:</span>{' '}
              {m.promptMissing}
            </p>
          )}
          {m.notable && (
            <p className="text-sm">
              <span className="text-pencil">worth joking about:</span>{' '}
              {m.notable}
            </p>
          )}
        </Block>
      )}

      {evaluated && (
        <Block title="the math" aside="every judge score, then what code added">
          {b ? (
            <ScoreMath run={run} breakdown={b} bonus={bonus} swing={swing} />
          ) : (
            <Adjustments run={run} />
          )}
        </Block>
      )}

      {evaluated && b && (b.improve || b.criteria?.some((c) => c.improve)) && (
        <Block title="what would have improved it" aside="admins only">
          <Improvements breakdown={b} />
        </Block>
      )}

      <Block
        title="the dice"
        aside="rolled before the judge saw the doodle, so its comment matches"
      >
        {m.swingRoll ? (
          <>
            <SwingDice roll={m.swingRoll} />
            {failed && rolledSwing(m.swingRoll).kind && (
              <p className="text-sm text-pencil">
                the run failed, so no score got it
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-pencil">
            {m.swing
              ? `${describeSwing(m.swing, swing)}; the rolls weren't kept for runs this old`
              : "no swing; the rolls weren't kept for runs this old"}
          </p>
        )}
      </Block>

      {calls.length > 0 && (
        <Block
          title="the calls"
          aside="every request to the model, as sent and answered"
        >
          <div className="flex flex-col gap-3">
            {calls.map((call, i) => (
              <CallDetails key={i} call={call} index={i} />
            ))}
          </div>
        </Block>
      )}

      {b?.message && (
        <Block title="what the judge was told" aside="with the doodle">
          <Pre>{b.message}</Pre>
        </Block>
      )}

      <div className="flex flex-col gap-2">
        {b?.answer && (
          <Fold title="the judge's answer, as it came back">
            <Pre>{prettyAnswer(b.answer)}</Pre>
          </Fold>
        )}
        <Fold title="personality prompt, as it ran">
          <Pre>{run.systemPrompt || '–'}</Pre>
        </Fold>
      </div>

      <div className="flex flex-wrap gap-x-4 text-sm text-pencil">
        <span>model {run.model || '–'}</span>
        <span>took {seconds(run.durationMs)}</span>
        {run.batchId && <span>batch {run.batchId.slice(0, 8)}</span>}
        {run.id && <span>run {run.id.slice(0, 8)}</span>}
        {run.submissionId && (
          <Link
            to="/draw/submission/$submissionId"
            params={{ submissionId: run.submissionId }}
            className="underline"
          >
            open doodle
          </Link>
        )}
      </div>
    </div>
  );
};

/** The swing the dice came to, worked out as the server does */
function rolledSwing(roll: AISwingRoll): { kind: string; points: number } {
  let r = roll.roll;
  for (const tier of roll.tiers) {
    if (r < tier.chance) {
      const size =
        Math.round((tier.min + roll.size * (tier.max - tier.min)) * 10) / 10;
      return { kind: tier.kind, points: roll.hates ? -size : size };
    }
    r -= tier.chance;
  }
  return { kind: '', points: 0 };
}
