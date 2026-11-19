import { useProgression } from '../api';
import { AdminPage, Panel, Section, StatTile, Tag } from '../components/ui';
import type { FC } from 'react';
import type { RankTier } from '@/levels/ranks';
import { LevelBadge } from '@/levels/LevelBadge';
import { LevelSeal, RankCard } from '@/levels/RankCard';
import { RANK_CARDS } from '@/levels/rankCards';
import ProgressBar from '@/pages/trophies/components/ProgressBar';
import {
  LEVEL_XP_STEP,
  RANK_TIERS,
  tierRange,
  xpToReach,
} from '@/levels/ranks';
import { levelTitle } from '@/pages/trophies/components/LevelCard';
import { cn } from '@/utils';

// Show a few levels past where Mythic begins
const LAST_LEVEL = 40;
// XP for one doodle, to put level costs in friendlier terms
const XP_PER_DOODLE = 10;

const number = (n: number) => n.toLocaleString();

/** What makes a tier's badge special, in words */
function effects(tier: RankTier): Array<string> {
  const list = [];
  if (tier.ring) list.push('rim');
  if (tier.sheen) list.push('glint');
  if (tier.sparkle) list.push('twinkles');
  if (tier.glow) list.push('glow');
  if (tier.holo) list.push('holo foil');
  return list;
}

const Detail: FC<{ label: string; value: string }> = ({ label, value }) => (
  <>
    <dt className="text-pencil">{label}</dt>
    <dd className="text-right font-bold tabular-nums">{value}</dd>
  </>
);

/** One level's badge; hovering or focusing it shows what it takes */
const LevelCell: FC<{
  level: number;
  tier: RankTier;
  players?: number;
  isHighest: boolean;
}> = ({ level, tier, players, isHighest }) => {
  const reach = xpToReach(level);
  const next = xpToReach(level + 1);

  return (
    <div
      tabIndex={0}
      aria-label={`Level ${level}`}
      className="group relative flex flex-col items-center gap-1.5 py-3 rounded-sketch outline-none hover:bg-paper focus-visible:bg-paper"
    >
      <LevelBadge level={level} size={44} />
      <span className="text-sm text-pencil leading-none">
        {players ? `${players} here` : ' '}
      </span>
      {isHighest && (
        <Tag className="absolute -top-2 -right-1 bg-butter text-xs px-1.5">
          top
        </Tag>
      )}

      <Panel
        className={cn(
          'absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 w-60 p-3 flex flex-col gap-2 text-left',
          'pointer-events-none opacity-0 scale-95 origin-bottom transition-[opacity,scale] duration-200 ease-[var(--ease-spring)]',
          'group-hover:opacity-100 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100',
        )}
      >
        <div className="flex items-center gap-2">
          <LevelBadge level={level} size={30} />
          <div className="flex flex-col leading-tight">
            <span className="font-accent font-bold text-lg leading-none">
              level {level}
            </span>
            <span className="text-sm text-pencil">
              {tier.name} · {levelTitle(level).toLowerCase()}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm">
          <Detail label="xp to reach" value={number(reach)} />
          <Detail label="xp for this level" value={number(next - reach)} />
          <Detail label="next level at" value={`${number(next)} xp`} />
          <Detail
            label="≈ doodles to reach"
            value={number(Math.ceil(reach / XP_PER_DOODLE))}
          />
          <Detail label="players here" value={number(players ?? 0)} />
        </dl>
      </Panel>
    </div>
  );
};

const LevelsPage = () => {
  const progression = useProgression();
  const playersAt = new Map(
    (progression.data?.levels ?? []).map((l) => [l.level, l.players]),
  );
  const highest = Math.max(
    0,
    ...[...playersAt].filter(([, n]) => n > 0).map(([level]) => level),
  );
  const top = RANK_TIERS[RANK_TIERS.length - 1];

  return (
    <AdminPage
      title="level ranks"
      subtitle="every rank's badge, from graphite to mythic. hover a level for what it takes"
    >
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="highest player"
          value={highest ? `lv ${highest}` : '–'}
          className="bg-butter"
        />
        <StatTile label="ranks" value={RANK_TIERS.length} />
        <StatTile
          label={`xp to reach ${top.name.toLowerCase()} (lv ${top.from})`}
          value={number(xpToReach(top.from))}
        />
      </div>
      <p className="text-pencil -mt-4">
        each level costs {LEVEL_XP_STEP} xp more than the one before it, so
        level n takes {LEVEL_XP_STEP / 2}·n·(n−1) xp in all
      </p>

      <Section title="rank cards">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-5 gap-y-8 pt-2">
          {RANK_TIERS.map((tier) => (
            <RankCard
              key={tier.id}
              level={tier.from}
              pin
              contentClassName="flex flex-col gap-2 p-4 pt-5"
            >
              <div className="flex items-center gap-3">
                <LevelSeal level={tier.from} size={48} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-pencil">
                    {tier.name.toLowerCase()} rank
                  </span>
                  <span className="font-accent font-bold text-2xl leading-none">
                    <span className="highlight">
                      {levelTitle(tier.from).toLowerCase()}
                    </span>
                  </span>
                </div>
              </div>
              <ProgressBar
                value={2}
                max={3}
                label={`${tier.name} sample progress`}
                fillBackground={RANK_CARDS[tier.id].fill}
              />
            </RankCard>
          ))}
        </div>
      </Section>

      {RANK_TIERS.map((tier) => {
        const { from, to } = tierRange(tier);
        const last = to ?? LAST_LEVEL;
        const levels = Array.from(
          { length: last - from + 1 },
          (_, i) => from + i,
        );
        return (
          <Section
            key={tier.id}
            title={
              <span className="flex items-center gap-3">
                <LevelBadge level={from} size={28} />
                {tier.name.toLowerCase()}
              </span>
            }
            aside={
              <span className="flex flex-wrap items-center justify-end gap-2">
                {effects(tier).map((effect) => (
                  <Tag key={effect}>{effect}</Tag>
                ))}
                <span className="text-pencil whitespace-nowrap">
                  lv {from}
                  {to ? `–${to}` : '+'} · from {number(xpToReach(from))} xp
                </span>
              </span>
            }
          >
            <Panel className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] p-2">
              {levels.map((level) => (
                <LevelCell
                  key={level}
                  level={level}
                  tier={tier}
                  players={playersAt.get(level)}
                  isHighest={level === highest}
                />
              ))}
            </Panel>
          </Section>
        );
      })}
    </AdminPage>
  );
};

export default LevelsPage;
