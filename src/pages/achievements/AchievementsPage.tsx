import { useNavigate, useSearch } from '@tanstack/react-router';
import { useRef } from 'react';
import Badge from '../trophies/components/Badge';
import ProgressBar from '../trophies/components/ProgressBar';
import type { FC, KeyboardEvent } from 'react';
import type { Achievement, AchievementCategory } from '@/api/Api';
import { useGetAchievementCatalog } from '@/api/Api';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { cn } from '@/utils';

export const CATEGORIES: Array<{
  id: AchievementCategory;
  label: string;
  blurb: string;
}> = [
  { id: 'drawing', label: 'drawing', blurb: 'For filling the sketchbook.' },
  { id: 'streaks', label: 'streaks', blurb: 'Doodle day after day.' },
  { id: 'friends', label: 'friends', blurb: 'Comments, reactions and pals.' },
  { id: 'judges', label: 'judges', blurb: 'What the judges make of you.' },
  { id: 'levels', label: 'levels', blurb: 'Earn XP, climb the ranks.' },
  {
    id: 'events',
    label: 'events',
    blurb: 'Limited-time stickers. What they are is a surprise.',
  },
];

export const isCategory = (tab: unknown): tab is AchievementCategory =>
  CATEGORIES.some((c) => c.id === tab);

const earnedOn = (achievement: Achievement) =>
  new Date(achievement.achievedAt!).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Earned first, by when; then the ones to work on; secrets last */
const rank = (a: Achievement) => (a.achievedAt ? 0 : a.secret ? 2 : 1);
const byCollection = (a: Achievement, b: Achievement) =>
  rank(a) - rank(b) ||
  (a.achievedAt && b.achievedAt
    ? new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime()
    : 0);

const SecretCard: FC<{ achievement: Achievement }> = ({ achievement }) => {
  const event = achievement.category === 'events';
  return (
    <li className="flex items-center gap-3 w-full p-3 border-2 border-dashed border-pencil rounded-sketch">
      <Badge achievement={achievement} className="size-14 shrink-0" />
      <div className="flex flex-col gap-1 min-w-0">
        <h3 className="font-accent font-bold text-xl leading-none text-pencil">
          {event ? 'mystery sticker' : 'secret achievement'}
        </h3>
        <p className="text-sm text-pencil leading-tight">
          {event
            ? 'Only shows itself during an event. Keep an eye out.'
            : 'How to earn this one is a secret. Keep doodling and you might stumble on it.'}
        </p>
      </div>
    </li>
  );
};

const EarnedCard: FC<{ achievement: Achievement }> = ({ achievement }) => (
  <li className="flex items-center gap-3 w-full p-3 bg-white border-2 border-ink rounded-sketch">
    <Badge achievement={achievement} className="size-16 shrink-0" />
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-accent font-bold text-xl leading-none truncate">
          {achievement.name}
        </h3>
        <span className="text-xs text-pencil whitespace-nowrap">
          {earnedOn(achievement)}
        </span>
      </div>
      <p className="text-sm text-pencil leading-tight">
        {achievement.description}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Chip className="h-6 text-sm bg-butter">collected</Chip>
        {achievement.hidden && (
          <Chip className="h-6 text-sm bg-blush">secret found</Chip>
        )}
        {achievement.reward && (
          <Chip className="h-6 text-sm">
            unlocked {achievement.reward.name.toLowerCase()}
          </Chip>
        )}
      </div>
    </div>
  </li>
);

const LockedCard: FC<{ achievement: Achievement }> = ({ achievement }) => {
  const { progress, achievementValue: goal } = achievement;
  return (
    <li className="flex items-center gap-3 w-full p-3 bg-white border-2 border-ink rounded-sketch">
      <Badge achievement={achievement} locked className="size-14 shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-accent font-bold text-xl leading-none truncate">
            {achievement.name}
          </h3>
          <span className="font-accent font-bold text-lg leading-none whitespace-nowrap">
            {Math.min(progress, goal)}/{goal}
          </span>
        </div>
        <p className="text-sm text-pencil leading-tight">
          {achievement.description}
          {achievement.best !== undefined && (
            <span className="text-pencil/70"> · best {achievement.best}</span>
          )}
        </p>
        <ProgressBar
          value={progress}
          max={goal}
          label={`${achievement.name} progress`}
          className="h-3"
        />
        {achievement.reward && (
          <div className="flex">
            <Chip className="h-6 text-sm bg-butter">
              unlocks {achievement.reward.name.toLowerCase()}
            </Chip>
          </div>
        )}
      </div>
    </li>
  );
};

const AchievementRow: FC<{ achievement: Achievement }> = ({ achievement }) => {
  if (achievement.achievedAt) return <EarnedCard achievement={achievement} />;
  if (achievement.secret) return <SecretCard achievement={achievement} />;
  return <LockedCard achievement={achievement} />;
};

const AchievementsPage = () => {
  const catalog = useGetAchievementCatalog();
  const { tab } = useSearch({ from: '/draw/achievements' });
  const navigate = useNavigate({ from: '/draw/achievements' });
  const tabRefs = useRef<Partial<Record<AchievementCategory, HTMLElement>>>({});

  if (catalog.isLoading) return <LoadingScreen />;

  if (!catalog.data) {
    return (
      <Layout back>
        <p className="text-center text-pencil">
          The achievements fell behind the couch. Give it another go?
        </p>
        <Button variant="base" size="sm" onClick={() => catalog.refetch()}>
          try again
        </Button>
      </Layout>
    );
  }

  const { achievements } = catalog.data;
  const inCategory = (id: AchievementCategory) =>
    achievements.filter((a) => a.category === id);
  const selected = tab ?? 'drawing';
  const current = CATEGORIES.find((c) => c.id === selected)!;
  const shown = inCategory(selected).sort(byCollection);
  const earnedCount = achievements.filter((a) => a.achievedAt).length;
  const secretsLeft = achievements.filter(
    (a) => a.secret && a.category !== 'events',
  ).length;

  const select = (id: AchievementCategory) =>
    navigate({ search: { tab: id }, replace: true, resetScroll: false });

  // Arrow keys move between tabs, like any tablist
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = CATEGORIES.findIndex((c) => c.id === selected);
    const next =
      CATEGORIES[(i + step + CATEGORIES.length) % CATEGORIES.length].id;
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <Layout
      back
      header={
        <section className="flex flex-col gap-2 w-full">
          <div className="flex items-end justify-between gap-2">
            <h1 className="font-accent font-bold text-[34px] leading-none">
              achievements
            </h1>
            <span className="font-accent font-bold text-xl leading-none">
              {earnedCount}/{achievements.length}
            </span>
          </div>
          <ProgressBar
            value={earnedCount}
            max={achievements.length}
            label="achievements collected"
            className="h-3"
          />
          {secretsLeft > 0 && (
            <p className="text-sm text-pencil">
              {secretsLeft} secret {secretsLeft === 1 ? 'one' : 'ones'} still
              hiding.
            </p>
          )}
        </section>
      }
    >
      <div
        role="tablist"
        aria-label="Achievement categories"
        onKeyDown={onKeyDown}
        className="flex gap-2 w-[calc(100%+3rem)] -mx-6 px-6 pb-1 overflow-x-auto [scrollbar-width:none]"
      >
        {CATEGORIES.map(({ id, label }) => {
          const all = inCategory(id);
          const earned = all.filter((a) => a.achievedAt).length;
          const active = id === selected;
          return (
            <button
              key={id}
              ref={(el) => {
                if (el) tabRefs.current[id] = el;
              }}
              role="tab"
              id={`tab-${id}`}
              aria-selected={active}
              aria-controls="achievement-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => select(id)}
              className={cn(
                'flex items-center gap-1.5 shrink-0 h-9 px-3 border-2 border-ink rounded-[14px_10px_14px_12px] font-accent font-bold text-lg leading-none transition-colors',
                active ? 'bg-ink text-white' : 'bg-white hover:bg-butter',
              )}
            >
              {label}
              <span
                className={cn(
                  'text-sm font-sans font-normal',
                  active ? 'text-white/80' : 'text-pencil',
                )}
              >
                {earned}/{all.length}
              </span>
            </button>
          );
        })}
      </div>

      <section
        id="achievement-panel"
        role="tabpanel"
        aria-labelledby={`tab-${selected}`}
        className="flex flex-col gap-3 w-full -mt-2"
      >
        <p className="text-pencil">{current.blurb}</p>
        {shown.length > 0 ? (
          <ul key={selected} className="flex flex-col gap-3 w-full stagger">
            {shown.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} />
            ))}
          </ul>
        ) : (
          <p className="w-full p-4 text-center text-pencil border-2 border-dashed border-pencil rounded-sketch">
            Nothing here yet. Check back soon.
          </p>
        )}
      </section>
    </Layout>
  );
};

export default AchievementsPage;
