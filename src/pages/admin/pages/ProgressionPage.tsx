import { useProgression } from '../api';
import {
  burstDemo,
  earnedAllDemo,
  levelUpDemo,
  questCompletedDemo,
  questProgressDemo,
  xpDemo,
} from '../animationDemos';
import { ShowAnimationButton } from '../components/AnimationPreview';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  StatTile,
  Table,
  formatDay,
  td,
  th,
} from '../components/ui';
import type { FC } from 'react';
import { levelTitle } from '@/levels/ranks';
import ProgressBar from '@/pages/trophies/components/ProgressBar';

const percent = (n: number, of: number) =>
  of > 0 ? `${Math.round((n / of) * 100)}%` : '–';

/** A bar with "n players · x%" beside it */
const Share: FC<{ n: number; of: number; label: string; fill?: string }> = ({
  n,
  of,
  label,
  fill,
}) => (
  <div className="flex items-center gap-3">
    <ProgressBar
      value={n}
      max={of}
      label={label}
      fill={fill}
      className="w-40 h-3"
    />
    <span className="whitespace-nowrap">
      <b>{percent(n, of)}</b> <span className="text-sm text-pencil">({n})</span>
    </span>
  </div>
);

const ProgressionPage = () => {
  const progression = useProgression();

  return (
    <AdminPage
      title="levels & quests"
      subtitle="where every player stands, and the rules that put them there"
    >
      <Loaded query={progression}>
        {({ xpRules, players, levels, quests, week }) => {
          // Players on each level or any level above it
          const reached = levels.map((_, i) =>
            levels.slice(i).reduce((sum, l) => sum + l.players, 0),
          );
          const highest = Math.max(
            1,
            ...levels.filter((l) => l.players > 0).map((l) => l.level),
          );

          return (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-8 items-start">
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="players" value={players} />
                  <StatTile
                    label="highest level"
                    value={`${highest} · ${levelTitle(highest)}`}
                    className="bg-butter"
                  />
                </div>

                <Section
                  title="weekly quests"
                  aside={
                    <span className="flex flex-wrap items-center justify-end gap-3">
                      <ShowAnimationButton
                        label="finish them all at once"
                        title={`all ${quests.length} quests at once`}
                        demo={earnedAllDemo([], quests)}
                      />
                      <ShowAnimationButton
                        label="a busy moment"
                        title="everything at once: cards, then XP, then rank"
                        demo={burstDemo(quests)}
                      />
                      {formatDay(week.start)} → {formatDay(week.end)}
                    </span>
                  }
                >
                  <div className="flex flex-col gap-3">
                    {quests.map((quest) => (
                      <Panel key={quest.id} className="flex flex-col gap-2 p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-accent font-bold text-xl leading-none">
                            {quest.title}
                          </h3>
                          <span className="flex items-center gap-2 text-sm text-pencil">
                            goal: {quest.goal}
                            <ShowAnimationButton
                              label="progress"
                              title={`${quest.title} progress`}
                              demo={questProgressDemo(quest)}
                            />
                            <ShowAnimationButton
                              label="done"
                              title={`${quest.title} done`}
                              demo={questCompletedDemo(quest)}
                            />
                          </span>
                        </div>
                        <p className="text-sm text-pencil">
                          {quest.description}
                        </p>
                        <div className="grid grid-cols-[90px_1fr] items-center gap-y-1">
                          <span className="text-sm">completed</span>
                          <Share
                            n={quest.completed}
                            of={players}
                            label={`${quest.title} completed`}
                            fill="bg-coral"
                          />
                          <span className="text-sm">started</span>
                          <Share
                            n={quest.started}
                            of={players}
                            label={`${quest.title} started`}
                          />
                        </div>
                      </Panel>
                    ))}
                  </div>
                </Section>

                <Section title="xp rules">
                  <Table
                    head={
                      <>
                        <th className={th}>action</th>
                        <th className={th}>xp</th>
                        <th className={th}>animation</th>
                      </>
                    }
                  >
                    {xpRules.map((rule) => (
                      <tr key={rule.action}>
                        <td className={td}>{rule.action}</td>
                        <td className={td}>
                          +{rule.xp}
                          {rule.maxXp ? `–${rule.maxXp}` : ''}
                        </td>
                        <td className={td}>
                          <ShowAnimationButton
                            label="+xp"
                            title={`+${rule.xp} xp: ${rule.action.toLowerCase()}`}
                            demo={xpDemo(4, rule.xp, 0.3)}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className={td}>level up</td>
                      <td className={td}>–</td>
                      <td className={td}>
                        <ShowAnimationButton
                          label="level up"
                          title="level 4 → 5"
                          demo={levelUpDemo(4)}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className={td}>level up into a new rank</td>
                      <td className={td}>–</td>
                      <td className={td}>
                        <ShowAnimationButton
                          label="new rank"
                          title="level 6 → 7, silver → gold"
                          demo={levelUpDemo(6)}
                        />
                      </td>
                    </tr>
                  </Table>
                </Section>
              </div>

              <Section title="levels" aside="by lifetime xp">
                <Table
                  head={
                    <>
                      <th className={th}>level</th>
                      <th className={th}>title</th>
                      <th className={th}>starts at</th>
                      <th className={th}>on it now</th>
                      <th className={th}>reached it</th>
                    </>
                  }
                >
                  {levels.map((l, i) => (
                    <tr key={l.level}>
                      <td className={td}>{l.level}</td>
                      <td className={td}>{levelTitle(l.level)}</td>
                      <td className={td}>{l.levelStartXp} xp</td>
                      <td className={td}>{l.players || '–'}</td>
                      <td className={td}>
                        <Share
                          n={reached[i]}
                          of={players}
                          label={`reached level ${l.level}`}
                        />
                      </td>
                    </tr>
                  ))}
                </Table>
              </Section>
            </div>
          );
        }}
      </Loaded>
    </AdminPage>
  );
};

export default ProgressionPage;
