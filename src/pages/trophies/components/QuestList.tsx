import type { FC } from 'react';
import type { Quest } from '@/api/trophies';
import XPSticker from '@/components/XPSticker';
import { cn } from '@/utils';

const Checkbox: FC<{ checked: boolean }> = ({ checked }) => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 30 30"
    fill="none"
    stroke="var(--color-ink)"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
    aria-hidden="true"
  >
    <path
      d="M4 5.5q11-1.5 21.5-.5.8 10 0 21-11 .8-21 0-.7-10 .5-20.5z"
      fill="white"
    />
    {checked && (
      <path
        d="M8 15l5 6L27 3"
        stroke="var(--color-coral)"
        strokeWidth={3.5}
        pathLength={40}
        strokeDasharray={40}
        className="animate-scribble"
      />
    )}
  </svg>
);

/** One dot per step, for small goals */
const Pips: FC<{ progress: number; goal: number }> = ({ progress, goal }) => (
  <span className="flex gap-1" aria-hidden="true">
    {Array.from({ length: goal }, (_, i) => (
      <span
        key={i}
        className={cn(
          'size-3 border-2 border-ink rounded-blob',
          i < progress ? 'bg-coral' : 'bg-white',
        )}
      />
    ))}
  </span>
);

/** Past this many steps, pips get too wide for the card's right edge */
const MAX_PIPS = 5;

const QuestItem: FC<{ quest: Quest }> = ({ quest }) => {
  const done = quest.progress >= quest.goal;

  return (
    <li
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2 border-2 border-ink rounded-sketch-alt shadow-pencil-sm',
        done ? 'bg-[#fff6c9]' : 'bg-white',
      )}
    >
      <Checkbox checked={done} />
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              'font-accent font-bold text-xl leading-none',
              done && 'line-through decoration-coral decoration-2',
            )}
          >
            {quest.title}
          </h3>
          {quest.xp > 0 && <XPSticker xp={quest.xp} />}
        </div>
        <p className="text-sm text-pencil leading-tight">{quest.description}</p>
      </div>
      {done ? (
        <span className="shrink-0 px-2 py-0.5 font-accent font-bold text-xl uppercase text-coral border-[2.5px] border-coral rounded-sketch -rotate-12 opacity-90 animate-in zoom-in-150 fade-in duration-300">
          done!
        </span>
      ) : (
        <span className="shrink-0 flex flex-col items-end gap-1">
          <span className="font-accent font-bold text-xl leading-none">
            {quest.progress}/{quest.goal}
          </span>
          {quest.goal <= MAX_PIPS && (
            <Pips progress={quest.progress} goal={quest.goal} />
          )}
        </span>
      )}
    </li>
  );
};

/** "resets in 3 days" until next week's quests begin */
export function weekResetLabel(resetsAt: string) {
  const hours = Math.ceil(
    (new Date(resetsAt).getTime() - Date.now()) / 3_600_000,
  );
  if (hours < 24) return `resets in ${Math.max(hours, 1)}h`;
  const days = Math.ceil(hours / 24);
  return `resets in ${days} day${days === 1 ? '' : 's'}`;
}

const QuestList: FC<{ quests: Array<Quest> }> = ({ quests }) => (
  <ul className="flex flex-col gap-3 w-full stagger">
    {quests.map((quest) => (
      <QuestItem key={quest.id} quest={quest} />
    ))}
  </ul>
);

export default QuestList;
