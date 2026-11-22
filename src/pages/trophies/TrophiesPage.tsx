import AchievementCard from './components/AchievementCard';
import { completion } from './components/AchievementMeter';
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
import { SectionLink } from '@/components/ShowAllLink';
import { currentSteps } from '@/achievements/paths';

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

const byClosestToDone = (a: Achievement, b: Achievement) =>
  completion(b) - completion(a);

const TrophiesPage = () => {
  const me = useUser();
  const trophies = useGetTrophies();
  const achievementsQuery = useGetAchievements();

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
  // Just the few current steps closest to done; the achievements page has the rest
  const inProgress = currentSteps(achievements)
    .filter((a) => !a.secret)
    .sort(byClosestToDone)
    .slice(0, UP_NEXT_COUNT);
  const questsDone = quests.filter((q) => q.progress >= q.goal).length;

  return (
    <Layout header={<LevelCard trophies={trophies.data} />}>
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

      {inProgress.length > 0 && (
        <>
          <SectionLink
            to="/draw/achievements"
            search={{ tab: 'next' }}
            heading="up next"
            className="-mb-2"
          />
          <ul className="flex flex-col gap-3 w-full stagger">
            {inProgress.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                linked
              />
            ))}
          </ul>
        </>
      )}

      <section className="relative flex flex-col gap-1 w-full px-4 pt-5 pb-4 bg-[#fff6c9] rotate-1 border-2 border-ink">
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
