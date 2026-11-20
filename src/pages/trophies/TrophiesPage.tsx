import { Link, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';
import AchievementCard, {
  AchievementSticker,
  stickerAnchor,
} from './components/AchievementCard';
import EventBanner from './components/EventBanner';
import Leaderboard from './components/Leaderboard';
import LevelCard from './components/LevelCard';
import QuestList, { weekResetLabel } from './components/QuestList';
import type { FC, ReactNode } from 'react';
import type { Achievement } from '@/api/Api';
import { useGetAchievements } from '@/api/Api';
import { useGetTrophies } from '@/api/trophies';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { PushPin } from '@/components/PushPin';

const SectionTitle: FC<{ children: ReactNode; aside?: ReactNode }> = ({
  children,
  aside,
}) => (
  <div className="flex items-end justify-between gap-2 w-full -mb-2">
    <h2 className="font-accent font-bold text-[28px] leading-none">
      {children}
    </h2>
    {aside}
  </div>
);

const UP_NEXT_COUNT = 3;

const completion = (a: Achievement) =>
  a.achievementValue > 0 ? a.progress / a.achievementValue : 0;

const byClosestToDone = (a: Achievement, b: Achievement) =>
  completion(b) - completion(a);

const byMostRecent = (a: Achievement, b: Achievement) =>
  new Date(b.achievedAt!).getTime() - new Date(a.achievedAt!).getTime();

const TrophiesPage = () => {
  const me = useUser();
  const trophies = useGetTrophies();
  const achievementsQuery = useGetAchievements();
  const linkedSticker = useLocation().hash.replace(/^#/, '');
  const loaded = !!trophies.data && !!achievementsQuery.data;

  // Links like /draw/trophies#sticker-12 land on that sticker. The router
  // scrolls to the hash itself, but only if the sticker was already rendered.
  useEffect(() => {
    if (loaded && linkedSticker) {
      document
        .getElementById(linkedSticker)
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loaded, linkedSticker]);

  if (trophies.isLoading || achievementsQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (!trophies.data || !achievementsQuery.data) {
    return (
      <Layout>
        <p className="text-center text-pencil">
          The trophy cabinet is stuck. Give it a jiggle?
        </p>
        <Button
          variant="base"
          size="sm"
          onClick={() =>
            Promise.all([trophies.refetch(), achievementsQuery.refetch()])
          }
        >
          try again
        </Button>
      </Layout>
    );
  }

  const { quests, questsEvent, leaderboard, week, xpRules } = trophies.data;
  const { achievements } = achievementsQuery.data;
  const earned = achievements.filter((a) => a.achievedAt).sort(byMostRecent);
  // Just the few closest to done; the achievements page has the rest
  const inProgress = achievements
    .filter((a) => !a.achievedAt && !a.secret)
    .sort(byClosestToDone)
    .slice(0, UP_NEXT_COUNT);
  const questsDone = quests.filter((q) => q.progress >= q.goal).length;

  return (
    <Layout
      header={
        <LevelCard trophies={trophies.data} stickerCount={earned.length} />
      }
    >
      <EventBanner liveEvent={questsEvent} />

      {/* While an event is live, its page has this week's quests */}
      {!questsEvent && (
        <>
          <SectionTitle aside={<Chip>{weekResetLabel(week.resetsAt)}</Chip>}>
            weekly quests
          </SectionTitle>
          <QuestList quests={quests} />
          {questsDone === quests.length && (
            <p className="-mt-2 font-accent font-bold text-xl text-center">
              <span className="highlight">every quest done. show-off.</span>
            </p>
          )}
        </>
      )}

      <SectionTitle aside={<span className="text-pencil">all time</span>}>
        friend leaderboard
      </SectionTitle>
      <Leaderboard entries={leaderboard} myId={me.id} />

      <SectionTitle
        aside={
          <span className="text-pencil">
            {earned.length}/{achievements.length} collected
          </span>
        }
      >
        sticker book
      </SectionTitle>
      {earned.length > 0 ? (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 w-full p-4 pt-5 bg-white border-2 border-ink rounded-sketch shadow-pencil">
          {earned.map((achievement, i) => (
            <AchievementSticker
              key={achievement.id}
              achievement={achievement}
              index={i}
              highlighted={stickerAnchor(achievement) === linkedSticker}
            />
          ))}
        </ul>
      ) : (
        <p className="w-full p-4 text-center text-pencil bg-white border-2 border-dashed border-pencil rounded-sketch">
          No stickers yet. Your first one is a single drawing away.
        </p>
      )}

      {inProgress.length > 0 && (
        <>
          <SectionTitle>up next</SectionTitle>
          <ul className="flex flex-col gap-3 w-full stagger">
            {inProgress.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </ul>
        </>
      )}
      <Link
        to="/draw/achievements"
        className="flex items-center justify-between gap-2 w-full -mt-2 px-4 py-3 bg-white border-2 border-ink rounded-sketch font-accent font-bold text-xl leading-none hover:bg-butter transition-colors"
      >
        see every achievement
        <span aria-hidden="true">→</span>
      </Link>

      <section className="relative flex flex-col gap-1 w-full px-4 pt-5 pb-4 bg-[#fff6c9] rotate-1 shadow-[1px_2px_6px_rgba(43,42,51,0.15)]">
        <PushPin
          color={'#ff6b57'}
          lean={-14}
          className="absolute z-10 -top-[23px] left-1/2 -ml-4"
        />
        <h2 className="font-accent font-bold text-xl leading-tight">
          how to earn XP
        </h2>
        <ul>
          {xpRules.map((rule) => (
            <li key={rule.action} className="flex justify-between gap-2">
              <span>{rule.action}</span>
              <span className="font-accent font-bold whitespace-nowrap">
                +{rule.xp}
                {rule.maxXp ? `–${rule.maxXp}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
};

export default TrophiesPage;
