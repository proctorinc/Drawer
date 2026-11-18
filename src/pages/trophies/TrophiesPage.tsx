import { useState } from 'react';
import AchievementCard, {
  AchievementSticker,
} from './components/AchievementCard';
import EventBanner from './components/EventBanner';
import Leaderboard from './components/Leaderboard';
import LevelCard from './components/LevelCard';
import QuestList from './components/QuestList';
import type { FC, ReactNode } from 'react';
import type { Achievement } from '@/api/Api';
import { useGetAchievements } from '@/api/Api';
import { useGetTrophies } from '@/api/trophies';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import ChristmasTrophies from '@/events/christmas/ChristmasTrophies';
import { useChristmas } from '@/events/useChristmas';

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

function weekResetLabel(resetsAt: string) {
  const hours = Math.ceil(
    (new Date(resetsAt).getTime() - Date.now()) / 3_600_000,
  );
  if (hours < 24) return `resets in ${Math.max(hours, 1)}h`;
  const days = Math.ceil(hours / 24);
  return `resets in ${days} day${days === 1 ? '' : 's'}`;
}

const completion = (a: Achievement) =>
  a.achievementValue > 0 ? a.progress / a.achievementValue : 0;

const byClosestToDone = (a: Achievement, b: Achievement) =>
  completion(b) - completion(a);

const byMostRecent = (a: Achievement, b: Achievement) =>
  new Date(b.achievedAt!).getTime() - new Date(a.achievedAt!).getTime();

/** During an event, year-round progress stays folded away under the event */
const YearRound: FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="w-full pt-4 border-t-2 border-dashed border-line font-accent font-bold text-xl text-pencil hover:text-ink transition-colors"
      >
        {open ? 'hide' : 'see'} your year-round trophies
      </button>
      {open && children}
    </>
  );
};

const TrophiesPage = () => {
  const me = useUser();
  const christmas = useChristmas();
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

  const { quests, leaderboard, week, xpRules } = trophies.data;
  // Event stickers live in the event's own section, not the year-round book
  const achievements = achievementsQuery.data.achievements.filter(
    (a) => !a.eventSlug,
  );
  const eventStickers = christmas
    ? achievementsQuery.data.achievements.filter(
        (a) => a.eventSlug === christmas.slug,
      )
    : [];
  const earned = achievements.filter((a) => a.achievedAt).sort(byMostRecent);
  const inProgress = achievements
    .filter((a) => !a.achievedAt)
    .sort(byClosestToDone);
  const questsDone = quests.filter((q) => q.progress >= q.goal).length;

  const levelCard = (
    <LevelCard trophies={trophies.data} stickerCount={earned.length} />
  );
  const yearRound = (
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

      <SectionTitle aside={<span className="text-pencil">this week</span>}>
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

      <section className="relative flex flex-col gap-1 w-full px-4 pt-5 pb-4 bg-[#fff6c9] rotate-1 shadow-[1px_2px_6px_rgba(43,42,51,0.15)]">
        <span
          aria-hidden="true"
          className="absolute -top-2.5 left-1/2 -ml-8 w-16 h-5 bg-blush/90 -rotate-2"
        />
        <h2 className="font-accent font-bold text-xl leading-tight">
          how to earn XP
        </h2>
        <ul>
          {xpRules.map((rule) => (
            <li key={rule.action} className="flex justify-between gap-2">
              <span>{rule.action}</span>
              <span className="font-accent font-bold">+{rule.xp}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );

  if (christmas) {
    return (
      <Layout>
        <ChristmasTrophies event={christmas} stickers={eventStickers} />
        <YearRound>
          {levelCard}
          {yearRound}
        </YearRound>
      </Layout>
    );
  }

  return (
    <Layout header={levelCard}>
      <EventBanner />
      {yearRound}
    </Layout>
  );
};

export default TrophiesPage;
