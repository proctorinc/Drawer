import { Fragment, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { describeSwing, useAIRuns } from '../api';
import {
  AdminPage,
  Loaded,
  SearchInput,
  StatTile,
  Table,
  Tag,
  formatDateTime,
  td,
  th,
} from '../components/ui';
import { RerunAIButton } from '../components/RerunAIButton';
import type { AIRun, AIRunKind, AIRunMetadata } from '../api';
import type { FC } from 'react';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { AI_SCORE_MAX, formatScore } from '@/ai/score';
import { cn } from '@/utils';

const KINDS: Record<AIRunKind, { label: string; color: string }> = {
  submission: { label: 'real doodle', color: 'bg-butter' },
  rerun: { label: 'admin re-run', color: 'bg-blush' },
  test: { label: 'testing ground', color: 'bg-sky' },
};

const SORTS = {
  newest: {
    label: 'newest first',
    compare: (a: AIRun, b: AIRun) => b.createdAt.localeCompare(a.createdAt),
  },
  oldest: {
    label: 'oldest first',
    compare: (a: AIRun, b: AIRun) => a.createdAt.localeCompare(b.createdAt),
  },
  highest: {
    label: 'highest score',
    compare: (a: AIRun, b: AIRun) => (b.score ?? -1) - (a.score ?? -1),
  },
  lowest: {
    label: 'lowest score',
    compare: (a: AIRun, b: AIRun) => (a.score ?? 99) - (b.score ?? 99),
  },
  slowest: {
    label: 'slowest',
    compare: (a: AIRun, b: AIRun) => b.durationMs - a.durationMs,
  },
} as const;
type SortKey = keyof typeof SORTS;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const judgeOf = (run: AIRun) => ({
  name: run.judgeName,
  avatarUrl: run.judgeAvatarUrl,
  decoration: run.judgeDecoration,
});

/** How the run's scores were adjusted in code after the judge answered */
const Adjustments: FC<{ metadata: AIRunMetadata }> = ({ metadata: m }) => {
  const parts: Array<string> = [];
  if (m.seen) parts.push(`saw: ${m.seen}`);
  if (m.prompt) {
    let prompt = `prompt: ${m.prompt}`;
    if (m.promptMissing) prompt += ` (missing ${m.promptMissing})`;
    if (m.promptBonus)
      prompt += ` ${m.promptBonus > 0 ? '+' : '−'}${Math.abs(m.promptBonus)} each`;
    parts.push(prompt);
  }
  if (m.effortPenalty) {
    parts.push(`${m.effort} effort: −${Math.round(m.effortPenalty * 100)}%`);
  }
  if (!m.swing && parts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-pencil">
      {m.swing && (
        <Tag
          className={
            m.swingPoints && m.swingPoints > 0 ? 'bg-butter' : 'bg-white'
          }
        >
          <b>{describeSwing(m.swing, m.swingPoints ?? 0)}</b> each
        </Tag>
      )}
      {parts.join(' · ')}
    </div>
  );
};

/** Everything about one run, under its row */
const RunDetails: FC<{ run: AIRun }> = ({ run }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-4 sm:gap-6 p-4 bg-paper">
    {run.imageUrl ? (
      <img
        src={run.imageUrl}
        alt={run.prompt}
        className="w-48 aspect-square object-contain border-2 border-ink rounded-sketch-alt bg-white"
      />
    ) : (
      <div className="w-48 aspect-square grid place-items-center text-pencil border-2 border-dashed border-line rounded-sketch-alt">
        no image
      </div>
    )}
    <div className="flex flex-col gap-3 min-w-0">
      {run.criteria.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {run.criteria.map((c) => (
            <Tag key={c.id} className="bg-white">
              {c.imageUrl && <img src={c.imageUrl} alt="" className="size-4" />}
              {c.name} <b>{formatScore(c.score)}</b>/{AI_SCORE_MAX}
            </Tag>
          ))}
        </div>
      )}
      <Adjustments metadata={run.metadata} />
      <div className="flex flex-wrap gap-x-4 text-sm text-pencil">
        <span>model {run.model || '–'}</span>
        <span>took {seconds(run.durationMs)}</span>
        {run.batchId && <span>batch {run.batchId.slice(0, 8)}</span>}
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
      <div>
        <div className="font-bold">personality prompt, as it ran</div>
        <pre className="mt-1 p-3 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs bg-white border-[1.5px] border-line rounded">
          {run.systemPrompt || '–'}
        </pre>
      </div>
    </div>
  </div>
);

/**
 * Every time a judge was asked about a doodle: real doodles, admin re-runs and
 * testing-ground runs, failures included.
 */
const AILogPage = () => {
  const query = useAIRuns();
  const [hidden, setHidden] = useState<Set<AIRunKind>>(new Set());
  const [failedOnly, setFailedOnly] = useState(false);
  const [judge, setJudge] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (kind: AIRunKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <AdminPage
      title="ai log"
      subtitle="every judge run: real doodles, re-runs and tests (newest 500 listed, all counted)"
      actions={
        <Link to="/draw/admin/ai/test" className="underline text-pencil">
          open the testing ground
        </Link>
      }
    >
      <Loaded query={query}>
        {({ runs, stats }) => {
          const judges = [...new Set(runs.map((r) => r.judgeName))].sort();
          const needle = search.trim().toLowerCase();
          const shown = runs
            .filter((r) => !hidden.has(r.kind))
            .filter((r) => !failedOnly || r.status === 'failed')
            .filter((r) => !judge || r.judgeName === judge)
            .filter(
              (r) =>
                !needle ||
                [r.prompt, r.comment, r.error, r.user?.username ?? '']
                  .join(' ')
                  .toLowerCase()
                  .includes(needle),
            )
            .sort(SORTS[sort].compare);

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <StatTile label="runs, ever" value={stats.total} />
                <StatTile label="real doodles" value={stats.submissions} />
                <StatTile label="tests" value={stats.tests} />
                <StatTile label="re-runs" value={stats.reruns} />
                <StatTile
                  label="failed"
                  value={stats.failed}
                  className={cn(stats.failed > 0 && 'bg-blush')}
                />
                <StatTile
                  label={`today · avg ${seconds(stats.avgDurationMs)}`}
                  value={stats.today}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(KINDS) as Array<AIRunKind>).map((kind) => (
                  <button
                    key={kind}
                    onClick={() => toggle(kind)}
                    className={cn(
                      'cursor-pointer',
                      hidden.has(kind) && 'opacity-40 line-through',
                    )}
                  >
                    <Tag className={KINDS[kind].color}>{KINDS[kind].label}</Tag>
                  </button>
                ))}
                <button
                  onClick={() => setFailedOnly(!failedOnly)}
                  className="cursor-pointer"
                >
                  <Tag className={failedOnly ? 'bg-coral' : 'bg-white'}>
                    failed only
                  </Tag>
                </button>
                <select
                  className="px-2 py-1 bg-white border-2 border-ink rounded-sketch-alt"
                  value={judge}
                  onChange={(e) => setJudge(e.target.value)}
                  aria-label="judge"
                >
                  <option value="">every judge</option>
                  {judges.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <select
                  className="px-2 py-1 bg-white border-2 border-ink rounded-sketch-alt"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="sort"
                >
                  {(Object.keys(SORTS) as Array<SortKey>).map((key) => (
                    <option key={key} value={key}>
                      {SORTS[key].label}
                    </option>
                  ))}
                </select>
                <div className="ml-auto">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="search prompts, comments, people"
                  />
                </div>
              </div>

              {shown.length === 0 ? (
                <p className="py-10 text-center text-pencil">
                  {runs.length === 0
                    ? 'no runs yet'
                    : 'nothing matches these filters'}
                </p>
              ) : (
                <Table
                  head={
                    <>
                      <th className={th}></th>
                      <th className={th}>judge</th>
                      <th className={th}>why</th>
                      <th className={th}>doodle</th>
                      <th className={th}>score</th>
                      <th className={th}>comment</th>
                      <th className={th}>when</th>
                      <th className={th}>
                        <span className="sr-only">re-run</span>
                      </th>
                    </>
                  }
                >
                  {shown.map((run) => (
                    <Fragment key={run.id}>
                      <tr
                        className="cursor-pointer"
                        onClick={() => setOpen(open === run.id ? null : run.id)}
                      >
                        <td className={td}>
                          {run.imageUrl && (
                            <img
                              src={run.imageUrl}
                              alt=""
                              className="size-12 object-cover border-[1.5px] border-ink rounded bg-white"
                            />
                          )}
                        </td>
                        <td className={td}>
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <AIJudgeAvatar judge={judgeOf(run)} />
                            {run.judgeName}
                          </span>
                        </td>
                        <td className={td}>
                          <Tag className={KINDS[run.kind].color}>
                            {KINDS[run.kind].label}
                          </Tag>
                          <div className="text-xs text-pencil mt-1">
                            {run.kind === 'submission' ? 'by ' : 'run by '}
                            {run.user?.username ?? 'someone'}
                          </div>
                        </td>
                        <td className={cn(td, 'max-w-48')}>“{run.prompt}”</td>
                        <td
                          className={cn(
                            td,
                            'font-accent font-bold text-xl whitespace-nowrap',
                          )}
                        >
                          {run.score !== null
                            ? `${formatScore(run.score)}/${AI_SCORE_MAX}`
                            : '–'}
                          {run.metadata.swing && (
                            <div className="font-body font-normal text-xs text-pencil">
                              {describeSwing(
                                run.metadata.swing,
                                run.metadata.swingPoints ?? 0,
                              )}
                            </div>
                          )}
                        </td>
                        <td className={cn(td, 'max-w-md')}>
                          {run.status === 'failed' ? (
                            <span className="text-coral">{run.error}</span>
                          ) : (
                            run.comment
                          )}
                        </td>
                        <td className={cn(td, 'text-sm text-pencil')}>
                          <div className="whitespace-nowrap">
                            {formatDateTime(run.createdAt)}
                          </div>
                          <div>{seconds(run.durationMs)}</div>
                        </td>
                        <td className={td}>
                          {run.submissionId && (
                            <RerunAIButton
                              submissionId={run.submissionId}
                              personalityId={run.personalityId}
                              judgeName={run.judgeName}
                              artist={
                                run.kind === 'submission'
                                  ? run.user?.username
                                  : undefined
                              }
                            />
                          )}
                        </td>
                      </tr>
                      {open === run.id && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <RunDetails run={run} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Table>
              )}
            </>
          );
        }}
      </Loaded>
    </AdminPage>
  );
};

export default AILogPage;
