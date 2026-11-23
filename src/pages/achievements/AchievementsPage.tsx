import {
  Link,
  useLocation,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Badge from '../trophies/components/Badge';
import { achievementAnchor } from '../trophies/components/AchievementCard';
import { UserProfileIcon } from '../profile/components/profile-icons/UserProfileIcon';
import ProgressBar from '../trophies/components/ProgressBar';
import {
  AchievementBar,
  AchievementCount,
  completion,
} from '../trophies/components/AchievementMeter';
import PathCarousel, { pathStepClassName } from './PathCarousel';
import type { FC, KeyboardEvent } from 'react';
import type {
  Achievement,
  AchievementCategory,
  AchievementReward,
  DecorationId,
} from '@/api/Api';
import type { AchievementPath } from '@/achievements/paths';
import { useGetAchievementCatalog } from '@/api/Api';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import XPSticker from '@/components/XPSticker';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { PencilIcon } from '@/components/icons';
import useUser from '@/auth/hooks/useUser';
import { DECORATIONS } from '@/decorations/decorations';
import { cn } from '@/utils';
import { currentSteps, groupPaths } from '@/achievements/paths';

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

/**
 * The first tab, before the categories: what you're closest to earning. Only
 * each path's current step; the ones after it wait their turn.
 */
const NEXT_UP = {
  id: 'next',
  label: 'next up',
  blurb: 'Closest to done first. Keep going!',
} as const;

export type AchievementTab = AchievementCategory | typeof NEXT_UP.id;

const TABS: Array<{ id: AchievementTab; label: string; blurb: string }> = [
  NEXT_UP,
  ...CATEGORIES,
];

export const isAchievementTab = (tab: unknown): tab is AchievementTab =>
  TABS.some((t) => t.id === tab);

const earnedOn = (achievement: Achievement) =>
  new Date(achievement.achievedAt!).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Not done first, closest to done at the top; then secrets; then earned, newest first */
const rank = (a: Achievement) => (a.achievedAt ? 2 : a.secret ? 1 : 0);
const byNotDoneFirst = (a: Achievement, b: Achievement) =>
  rank(a) - rank(b) ||
  (a.achievedAt && b.achievedAt
    ? new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()
    : completion(b) - completion(a));

/** The step a path's carousel opens on: the current one, or its last once all are done */
const focus = (path: AchievementPath) =>
  path.steps[Math.min(path.current, path.steps.length - 1)];

// The preview avatar is a picture of you, not a link to your profile
const ignoreClick = () => {};

const decorationOf = (reward: AchievementReward) =>
  reward.id in DECORATIONS ? (reward.id as DecorationId) : null;

/**
 * What an achievement unlocks, shown on you: your avatar wearing the flair,
 * faded behind a lock until it's earned, then a tap away from trying it on
 */
const RewardPanel: FC<{ reward: AchievementReward; earned: boolean }> = ({
  reward,
  earned,
}) => {
  const me = useUser();
  const decoration = decorationOf(reward);
  const name = decoration
    ? DECORATIONS[decoration].name
    : reward.name.toLowerCase();

  const contents = (
    <>
      <span className={cn('relative flex p-1.5', !earned && 'opacity-80')}>
        {decoration ? (
          <UserProfileIcon
            user={{ ...me, decoration }}
            decorationPreview
            size="lg"
            showLevel={false}
            onClick={ignoreClick}
            className="hover:scale-100 hover:rotate-0"
          />
        ) : (
          <span className="flex items-center justify-center size-12 bg-white border-2 border-ink rounded-full">
            <PencilIcon size={22} />
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5 flex-1 min-w-0 text-left">
        <span className="text-xs text-pencil leading-none">
          {decoration
            ? earned
              ? 'flair unlocked'
              : 'unlocks flair'
            : earned
              ? 'unlocked'
              : 'unlocks'}
        </span>
        <span className="font-accent font-bold text-lg leading-none">
          {name}
        </span>
      </span>
      {earned && decoration ? (
        <span className="shrink-0 font-accent font-bold leading-none underline decoration-2 underline-offset-4">
          try it on →
        </span>
      ) : (
        !earned && (
          <span className="flex items-center justify-center shrink-0 size-6 rounded-full bg-ink text-white text-[11px]">
            <FontAwesomeIcon icon={faLock} />
          </span>
        )
      )}
    </>
  );

  const panelClass = cn(
    'flex items-center gap-2 w-full pr-3 border-2 rounded-sketch-alt',
    earned ? 'bg-me border-ink' : 'bg-paper border-dashed border-pencil',
  );

  return earned && decoration ? (
    <Link
      to="/draw/profile/me"
      hash="decorations"
      search={{ try: decoration }}
      aria-label={`try on ${name}`}
      className={cn(panelClass, 'press cursor-pointer')}
    >
      {contents}
    </Link>
  ) : (
    <div className={panelClass}>{contents}</div>
  );
};

/** Every card on the page: a link to one makes it wiggle into view */
const cardShell = (achievement: Achievement, highlighted: boolean) => ({
  id: achievementAnchor(achievement),
  className: cn(
    'scroll-mt-[calc(50vh-6rem)]',
    highlighted && 'outline-[3px] outline-coral outline-offset-2',
  ),
  badge: cn(highlighted && 'animate-[wiggle_0.6s_ease-in-out_500ms_2]'),
});

type CardProps = {
  achievement: Achievement;
  highlighted: boolean;
  className?: string;
};

const SecretCard: FC<CardProps> = ({ achievement, highlighted, className }) => {
  const event = achievement.category === 'events';
  const shell = cardShell(achievement, highlighted);
  return (
    <li
      id={shell.id}
      className={cn(
        'flex items-center gap-3 w-full p-3 border-2 border-dashed border-pencil rounded-sketch',
        shell.className,
        className,
      )}
    >
      <Badge
        achievement={achievement}
        className={cn('size-14 shrink-0', shell.badge)}
      />
      <div className="flex flex-col gap-1 min-w-0">
        <h3 className="font-accent font-bold text-xl leading-none text-pencil">
          {event ? 'mystery sticker' : 'secret achievement'}
        </h3>
        <p className="text-sm text-pencil leading-tight">
          {event
            ? 'Only shows itself during an event. Keep an eye out.'
            : 'How to complete this one is a secret. Keep doodling and you might stumble on it.'}
        </p>
      </div>
    </li>
  );
};

const EarnedCard: FC<CardProps> = ({ achievement, highlighted, className }) => {
  const shell = cardShell(achievement, highlighted);
  return (
    <li
      id={shell.id}
      className={cn(
        'flex flex-col gap-3 w-full p-3 bg-white border-2 border-ink rounded-sketch',
        shell.className,
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Badge
          achievement={achievement}
          className={cn('size-16 shrink-0', shell.badge)}
        />
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
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip className="h-6 text-sm bg-me">collected</Chip>
            {achievement.xp > 0 && <XPSticker xp={achievement.xp} />}
            {achievement.hidden && (
              <Chip className="h-6 text-sm bg-blush">secret found</Chip>
            )}
          </div>
        </div>
      </div>
      {achievement.reward && <RewardPanel reward={achievement.reward} earned />}
    </li>
  );
};

const LockedCard: FC<CardProps> = ({ achievement, highlighted, className }) => {
  const shell = cardShell(achievement, highlighted);
  return (
    <li
      id={shell.id}
      className={cn(
        'flex flex-col gap-3 w-full p-3 bg-white border-2 border-ink rounded-sketch',
        shell.className,
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Badge
          achievement={achievement}
          locked
          className={cn('size-14 shrink-0', shell.badge)}
        />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-accent font-bold text-xl leading-none truncate">
                {achievement.name}
              </h3>
              {achievement.xp > 0 && <XPSticker xp={achievement.xp} />}
            </div>
            <AchievementCount achievement={achievement} />
          </div>
          <p className="text-sm text-pencil leading-tight">
            {achievement.description}
            {achievement.best !== undefined && (
              <span className="text-pencil/70"> · best {achievement.best}</span>
            )}
          </p>
          <AchievementBar achievement={achievement} />
        </div>
      </div>
      {achievement.reward && (
        <RewardPanel reward={achievement.reward} earned={false} />
      )}
    </li>
  );
};

const AchievementRow: FC<CardProps> = (props) => {
  if (props.achievement.achievedAt) return <EarnedCard {...props} />;
  if (props.achievement.secret) return <SecretCard {...props} />;
  return <LockedCard {...props} />;
};

const AchievementsPage = () => {
  const catalog = useGetAchievementCatalog();
  const { tab } = useSearch({ from: '/_app/draw/achievements' });
  const navigate = useNavigate({ from: '/draw/achievements' });
  const tabRefs = useRef<Partial<Record<AchievementTab, HTMLElement>>>({});
  const linked = useLocation().hash.replace(/^#/, '');

  // Links like ...#achievement-12 land on that card. The router scrolls to
  // the hash itself, but only if the card was already rendered.
  useEffect(() => {
    if (catalog.data && linked) {
      document
        .getElementById(linked)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [catalog.data, linked]);

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
  const inTab = (id: AchievementTab) =>
    id === NEXT_UP.id
      ? currentSteps(achievements).filter((a) => !a.secret)
      : achievements.filter((a) => a.category === id);
  const selected = tab ?? NEXT_UP.id;
  const current = TABS.find((t) => t.id === selected)!;
  // Next up is just the current steps. A category lines each path up in a
  // carousel, placed by the step it opens on.
  const shown =
    selected === NEXT_UP.id
      ? inTab(selected)
          .sort(byNotDoneFirst)
          .map((a) => ({ id: a.id, steps: [a], current: 0 }))
      : groupPaths(inTab(selected)).sort((a, b) =>
          byNotDoneFirst(focus(a), focus(b)),
        );
  const earnedCount = achievements.filter((a) => a.achievedAt).length;
  const secretsLeft = achievements.filter(
    (a) => a.secret && a.category !== 'events',
  ).length;

  const select = (id: AchievementTab) =>
    navigate({ search: { tab: id }, replace: true, resetScroll: false });

  // Arrow keys move between tabs, like any tablist
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === selected);
    const next = TABS[(i + step + TABS.length) % TABS.length].id;
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
        {TABS.map(({ id, label }) => {
          const all = inTab(id);
          const earned = all.filter((a) => a.achievedAt).length;
          const active = id === selected;
          const count =
            id === NEXT_UP.id ? all.length : `${earned}/${all.length}`;
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
                active ? 'bg-ink text-white' : 'bg-white hover:bg-me',
              )}
            >
              {label}
              <span
                className={cn(
                  'text-sm font-sans font-normal',
                  active ? 'text-white/80' : 'text-pencil',
                )}
              >
                {count}
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
            {shown.map((path) =>
              path.steps.length > 1 ? (
                <PathCarousel
                  key={path.id}
                  path={path}
                  linkedId={
                    path.steps.find((a) => achievementAnchor(a) === linked)?.id
                  }
                  renderStep={(achievement) => (
                    <AchievementRow
                      key={achievement.id}
                      achievement={achievement}
                      highlighted={achievementAnchor(achievement) === linked}
                      className={pathStepClassName}
                    />
                  )}
                />
              ) : (
                <AchievementRow
                  key={path.id}
                  achievement={path.steps[0]}
                  highlighted={achievementAnchor(path.steps[0]) === linked}
                />
              ),
            )}
          </ul>
        ) : (
          <p className="w-full p-4 text-center text-pencil border-2 border-dashed border-pencil rounded-sketch">
            {selected === NEXT_UP.id
              ? 'You’ve completed every achievement there is. Wow.'
              : 'Nothing here yet. Check back soon.'}
          </p>
        )}
      </section>
    </Layout>
  );
};

export default AchievementsPage;
