import { useAdminAchievements, useAdminUsers } from '../api';
import { AdminPage, Loaded, Panel, Section, Tag } from '../components/ui';
import type { AdminAchievement } from '../api';
import type { FC } from 'react';
import AchievementCard, {
  AchievementSticker,
} from '@/pages/trophies/components/AchievementCard';
import Badge from '@/pages/trophies/components/Badge';

/** The same achievement as a player sees it: earned, locked, and almost there */
const AchievementDemo: FC<{
  achievement: AdminAchievement;
  index: number;
  players: number;
}> = ({ achievement, index, players }) => {
  const goal = achievement.achievementValue;
  const earned = { ...achievement, achievedAt: new Date(), progress: goal };
  const inProgress = {
    ...achievement,
    achievedAt: null,
    progress: Math.floor(goal * 0.75),
  };

  return (
    <Panel className="grid grid-cols-[160px_110px_1fr_220px] items-center gap-6 p-4">
      <ul className="flex justify-center">
        <AchievementSticker achievement={earned} index={index} />
      </ul>
      <div className="flex flex-col items-center gap-1 text-sm text-pencil">
        <Badge achievement={achievement} locked className="size-16" />
        locked
      </div>
      <ul>
        <AchievementCard achievement={inProgress} />
      </ul>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-pencil">id</dt>
        <dd className="font-mono text-xs break-all">{achievement.id}</dd>
        <dt className="text-pencil">counts</dt>
        <dd>
          {achievement.achievementField} ≥ {goal}
        </dd>
        <dt className="text-pencil">earned by</dt>
        <dd>
          {achievement.earnedBy} of {players}
        </dd>
        <dt className="text-pencil">unlocks</dt>
        <dd>
          {achievement.reward ? (
            <Tag className="bg-butter">{achievement.reward.name}</Tag>
          ) : (
            '–'
          )}
        </dd>
      </dl>
    </Panel>
  );
};

const AchievementsPage = () => {
  const achievements = useAdminAchievements();
  const players = useAdminUsers().data?.length ?? 0;

  return (
    <AdminPage
      title="achievements"
      subtitle="every sticker, shown earned, locked and in progress"
    >
      <Loaded query={achievements}>
        {(list) => {
          const groups = new Map<string, Array<AdminAchievement>>();
          for (const a of list) {
            const group = a.eventSlug ?? 'everyday';
            groups.set(group, [...(groups.get(group) ?? []), a]);
          }
          return [...groups].map(([group, items]) => (
            <Section
              key={group}
              title={group}
              aside={`${items.length} stickers`}
            >
              <div className="flex flex-col gap-3">
                {items.map((achievement, i) => (
                  <AchievementDemo
                    key={achievement.id}
                    achievement={achievement}
                    index={i}
                    players={players}
                  />
                ))}
              </div>
            </Section>
          ));
        }}
      </Loaded>
    </AdminPage>
  );
};

export default AchievementsPage;
