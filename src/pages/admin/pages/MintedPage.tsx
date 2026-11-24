import { useEffect, useMemo, useState } from 'react';
import { useAIRuns } from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Table,
  formatDateTime,
  td,
  th,
} from '../components/ui';
import type { AIRun } from '../api';
import type { FC, ReactNode } from 'react';
import type { MintCard, MintSource, Population, TierId } from '@/mint/mint';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { formatScore } from '@/ai/score';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { MintedPolaroid3D } from '@/mint/MintedPolaroid3D';
import {
  GRADES,
  GRADE_NAMES,
  NOT_TRACKED_YET,
  SIGNATURE_FONTS_HREF,
  TIERS,
  buildCards,
  compactOdds,
  payloadFor,
} from '@/mint/mint';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

/** Each tier's frame, as a swatch */
const FRAME: Record<TierId, string> = {
  misprint: '#fbf3dc',
  common: '#ffffff',
  uncommon: '#c8f0d8',
  silver: '#d9e2ee',
  gold: 'var(--color-gold)',
  holo: 'repeating-linear-gradient(115deg,#ffd9d2 0 6px,#ffe08a 6px 12px,#c8f0d8 12px 18px,#dcebff 18px 24px,#e6dcff 24px 30px)',
};

// A score that lands in each tier, for trying a doodle out as any of them
const TRY_SCORE: Record<TierId, number> = {
  misprint: 1.2,
  common: 3.6,
  uncommon: 6.4,
  silver: 8.4,
  gold: 9.4,
  holo: 10,
};

/** The newest finished review of each real doodle in the AI log */
const sourcesFrom = (runs: Array<AIRun>): Array<MintSource> => {
  const latest = new Map<string, AIRun>();
  for (const run of runs) {
    if (run.kind === 'test' || run.status !== 'done') continue;
    if (!run.submissionId || run.score == null || !run.user) continue;
    const seen = latest.get(run.submissionId);
    if (!seen || seen.createdAt < run.createdAt)
      latest.set(run.submissionId, run);
  }
  return [...latest.values()].map((run) => ({
    submissionId: run.submissionId!,
    imageUrl: run.imageUrl,
    prompt: run.prompt,
    user: run.user!,
    judge: {
      id: run.personalityId,
      name: run.judgeName,
      avatarUrl: run.judgeAvatarUrl,
      decoration: run.judgeDecoration,
    },
    systemPrompt: run.systemPrompt,
    model: run.model,
    score: run.score!,
    criteria: run.criteria,
    comment: run.comment,
    durationMs: run.durationMs,
    reviewedAt: run.createdAt,
    metadata: run.metadata,
  }));
};

const TierSwatch: FC<{ tier: TierId; className?: string }> = ({
  tier,
  className,
}) => (
  <span
    className={cn('inline-block size-4 border-[1.5px] border-ink', className)}
    style={{ background: FRAME[tier] }}
  />
);

/** The payload as JSON, with the fields Drawer doesn't record yet picked out */
const Payload: FC<{ card: MintCard }> = ({ card }) => {
  const [payload, setPayload] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    payloadFor(card).then(
      (p) => live && setPayload(JSON.stringify(p, null, 2)),
    );
    return () => {
      live = false;
    };
  }, [card]);

  if (!payload) return <p className="text-pencil">working it out…</p>;
  return (
    <pre className="max-h-[420px] overflow-auto p-3 bg-paper border-[1.5px] border-ink rounded-sketch-alt font-mono text-xs leading-relaxed">
      {payload.split(/(: null)/).map((part, i) =>
        part === ': null' ? (
          <span key={i}>
            : <span className="px-1 bg-blush text-ink rounded">null</span>
          </span>
        ) : (
          part
        ),
      )}
    </pre>
  );
};

const Fact: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex flex-col min-w-0">
    <dt className="font-accent font-bold text-sm uppercase tracking-wider text-pencil">
      {label}
    </dt>
    <dd className="m-0 truncate">{children}</dd>
  </div>
);

const CardDetails: FC<{ card: MintCard; population: Population }> = ({
  card,
  population,
}) => {
  const s = card.source;
  const pop = population.of(card);
  const m = s.metadata;
  return (
    <Panel className="flex flex-col gap-5 p-5 min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <TierSwatch tier={card.tier.id} className="size-6" />
        <h3 className="font-accent font-bold text-3xl leading-none">
          {card.tier.name}
        </h3>
        <span className="text-lg">
          1 in {compactOdds(card.rarity.odds)} · {card.rarity.rank}
        </span>
        <span className="ml-auto text-pencil">
          {card.cond.overall} {GRADE_NAMES[card.cond.overall]}
        </span>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 m-0">
        <Fact label="drawn by">
          <span className="inline-flex items-center gap-2">
            <UserProfileIcon user={s.user} size="xs" showLevel={false} />
            {s.user.username}
          </span>
        </Fact>
        <Fact label="prompt">{s.prompt}</Fact>
        <Fact label="serial">
          No. {card.serial} · {card.set}
        </Fact>
        <Fact label="judge">
          <span className="inline-flex items-center gap-2">
            <AIJudgeAvatar judge={s.judge} size="xs" />
            {s.judge.name}
          </span>
        </Fact>
        <Fact label="model">{s.model || '—'}</Fact>
        <Fact label="reviewed">
          {formatDateTime(s.reviewedAt)} · {(s.durationMs / 1000).toFixed(1)}s
        </Fact>
        <Fact label="score">
          {formatScore(s.score)}/10
          {m.swingPoints
            ? ` · swing ${m.swingPoints > 0 ? '+' : ''}${m.swingPoints}`
            : ''}
        </Fact>
        <Fact label="condition (preview roll)">
          {card.cond.centering} · {card.cond.corners} · {card.cond.edges} ·{' '}
          {card.cond.surface}
        </Fact>
        <Fact label="population">
          {pop.both} of {pop.tier} {card.tier.name} at {card.cond.overall}
        </Fact>
      </dl>
      <div className="flex flex-col gap-2">
        <h4 className="font-accent font-bold text-xl leading-none">
          what the card would sign
        </h4>
        <p className="text-pencil">
          The back stays simple. The token holds everything about the review.
          Highlighted <span className="px-1 bg-blush rounded">null</span>s are
          things Drawer doesn't record yet.
        </p>
        <Payload card={card} />
        <div className="flex flex-wrap gap-1.5">
          {NOT_TRACKED_YET.map((item) => (
            <span
              key={item}
              className="px-2 py-0.5 text-sm rounded-full border-[1.5px] border-line bg-white"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
};

const PopulationTable: FC<{ population: Population }> = ({ population }) => (
  <Table
    head={
      <>
        <th className={th}>tier</th>
        {GRADES.map((g) => (
          <th key={g} className={cn(th, 'text-right')}>
            {g}
          </th>
        ))}
        <th className={cn(th, 'text-right')}>total</th>
      </>
    }
  >
    {[...TIERS].reverse().map((tier) => (
      <tr key={tier.id}>
        <td className={cn(td, 'font-bold')}>
          <span className="inline-flex items-center gap-2">
            <TierSwatch tier={tier.id} />
            {tier.name}
          </span>
        </td>
        {GRADES.map((g) => (
          <td key={g} className={cn(td, 'text-right tabular-nums')}>
            {population.count(tier.id, g) || (
              <span className="text-line">0</span>
            )}
          </td>
        ))}
        <td className={cn(td, 'text-right tabular-nums font-bold')}>
          {population.byTier[tier.id]}
        </td>
      </tr>
    ))}
    <tr className="bg-paper">
      <td className={cn(td, 'font-bold')}>all</td>
      {GRADES.map((g) => (
        <td key={g} className={cn(td, 'text-right tabular-nums font-bold')}>
          {population.byGrade[g]}
        </td>
      ))}
      <td className={cn(td, 'text-right tabular-nums font-bold')}>
        {population.total}
      </td>
    </tr>
  </Table>
);

/** Every judge who's reviewed something here, with the signature they'd sign with */
const Signatures: FC<{ cards: Array<MintCard> }> = ({ cards }) => {
  const judges = [
    ...new Map(cards.map((c) => [c.source.judge.id, c])).values(),
  ];
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      {judges.map((card) => (
        <li key={card.source.judge.id}>
          <Panel className="flex items-end gap-4 p-4">
            <AIJudgeAvatar judge={card.source.judge} size="xl" />
            <div className="flex flex-col flex-1 min-w-0">
              <span
                className="-rotate-3 origin-bottom-left whitespace-nowrap leading-tight -mb-2 pl-1"
                style={{
                  fontFamily: card.signature.font,
                  color: card.signature.ink,
                  fontSize: `${card.signature.scale * 330}px`,
                }}
              >
                {card.signature.text}
              </span>
              <span className="pt-1 border-t-[1.5px] border-ink truncate">
                {card.source.judge.name}
              </span>
              <span className="text-sm text-pencil truncate">
                {card.signature.font.split(',')[0].replace(/'/g, '')}
              </span>
            </div>
          </Panel>
        </li>
      ))}
    </ul>
  );
};

const MintedPreview: FC<{ runs: Array<AIRun> }> = ({ runs }) => {
  const { cards, population } = useMemo(
    () => buildCards(sourcesFrom(runs)),
    [runs],
  );
  const [filter, setFilter] = useState<TierId | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Shows the selected doodle as another tier, to see every frame on real art
  const [tryTier, setTryTier] = useState<TierId | null>(null);
  const rarestFirst = useMemo(
    () => [...cards].sort((a, b) => b.rarity.odds - a.rarity.odds),
    [cards],
  );
  const shown =
    filter === 'all'
      ? rarestFirst
      : rarestFirst.filter((card) => card.tier.id === filter);
  const selected =
    cards.find((card) => card.id === selectedId) ??
    shown.at(0) ??
    rarestFirst.at(0);

  if (!selected) {
    return (
      <Panel className="p-6 text-pencil">
        No judged doodles in the AI log yet. Once a judge reviews one, it shows
        up here as the card it would become.
      </Panel>
    );
  }

  return (
    <>
      <Section title="inspect" aside="drag to turn it, tap to flip it over">
        <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] items-start">
          <div className="flex flex-col items-center gap-4">
            <MintedPolaroid3D
              card={
                tryTier
                  ? {
                      ...selected,
                      tier: TIERS.find((t) => t.id === tryTier)!,
                      source: { ...selected.source, score: TRY_SCORE[tryTier] },
                    }
                  : selected
              }
              pop={population.of(selected)}
            />
            <div className="flex flex-wrap justify-center items-center gap-1.5 max-w-[360px]">
              <span className="text-pencil">try it as</span>
              {([null, ...TIERS.map((t) => t.id)] as const).map((id) => (
                <button
                  key={id ?? 'real'}
                  type="button"
                  aria-pressed={tryTier === id}
                  onClick={() => setTryTier(id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-sm rounded-full border-2 border-ink bg-white press',
                    tryTier === id && 'bg-butter shadow-pencil-sm',
                  )}
                >
                  {id && <TierSwatch tier={id} className="size-3" />}
                  {id ? TIERS.find((t) => t.id === id)!.name : 'its real tier'}
                </button>
              ))}
            </div>
          </div>
          <CardDetails card={selected} population={population} />
        </div>
      </Section>

      <Section
        title="every judged doodle"
        aside={`${cards.length} cards, rarest first`}
      >
        <div className="flex flex-wrap gap-2">
          {(['all', ...[...TIERS].reverse().map((t) => t.id)] as const).map(
            (id) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 border-ink bg-white press',
                  filter === id && 'bg-butter shadow-pencil-sm',
                )}
              >
                {id !== 'all' && <TierSwatch tier={id} />}
                {id === 'all' ? 'all' : TIERS.find((t) => t.id === id)!.name}
                <span className="text-pencil">
                  {id === 'all' ? cards.length : population.byTier[id]}
                </span>
              </button>
            ),
          )}
        </div>
        {shown.length === 0 && (
          <p className="text-pencil">No {filter} cards yet.</p>
        )}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
          {shown.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => setSelectedId(card.id)}
                aria-pressed={card.id === selected.id}
                aria-label={`${card.source.user.username}'s ${card.tier.name}, ${formatScore(card.source.score)}`}
                className={cn(
                  'w-full p-1.5 pb-0 border-2 border-ink text-left press',
                  card.id === selected.id && 'shadow-pencil-sm -rotate-2',
                )}
                style={{ background: FRAME[card.tier.id] }}
              >
                <span className="block aspect-square overflow-hidden border-[1.5px] border-ink bg-[#fff8ec]">
                  <DrawingImage imageUrl={card.source.imageUrl} alt="" />
                </span>
                <span className="flex items-center justify-between gap-1 py-1 text-sm">
                  <span className="font-accent font-bold truncate">
                    {card.tier.name}
                  </span>
                  <span>{formatScore(card.source.score)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="population" aside="counted from the cards above">
        <PopulationTable population={population} />
      </Section>

      <Section title="the judges' signatures">
        <Signatures cards={cards} />
      </Section>
    </>
  );
};

/**
 * A preview of minted polaroids on real doodles: what each judged doodle's
 * card would be, in 3D, signed by its judge. Built from the AI log in the
 * browser; nothing is signed or saved.
 */
const MintedPage = () => {
  const query = useAIRuns();
  return (
    <AdminPage
      title="minted polaroids"
      subtitle="a preview: every judged doodle as the card it would become. nothing is signed or saved yet."
    >
      <link rel="stylesheet" href={SIGNATURE_FONTS_HREF} precedence="default" />
      <Loaded query={query}>
        {(data) => <MintedPreview runs={data.runs} />}
      </Loaded>
    </AdminPage>
  );
};

export default MintedPage;
