import { useId, useState } from 'react';
import type { FC, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/utils';

type Panel = {
  label: string;
  /** Shown beside the tabs while this panel is open */
  aside: ReactNode;
  content: ReactNode;
};

type Props = {
  standings: Panel;
  quests: Panel;
};

/** Standings on the left, quests on the right; one shows at a time */
const StandingsAndQuests: FC<Props> = ({ standings, quests }) => {
  const panels = [standings, quests];
  const [selected, setSelected] = useState(0);
  const id = useId();
  const tabId = (i: number) => `${id}-tab-${i}`;
  const panelId = (i: number) => `${id}-panel-${i}`;

  // Arrow keys move between tabs, as screen reader users expect of a tab list
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next = selected === 0 ? 1 : 0;
    setSelected(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <section className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          className="flex p-1 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm"
          onKeyDown={onKeyDown}
        >
          {panels.map((panel, i) => (
            <button
              key={panel.label}
              id={tabId(i)}
              type="button"
              role="tab"
              aria-selected={selected === i}
              aria-controls={panelId(i)}
              tabIndex={selected === i ? 0 : -1}
              onClick={() => setSelected(i)}
              className={cn(
                'px-3 py-1 font-accent font-bold text-xl leading-none rounded-sketch transition-colors cursor-pointer',
                selected === i
                  ? 'bg-me text-ink'
                  : 'text-pencil hover:text-ink',
              )}
            >
              {panel.label}
            </button>
          ))}
        </div>
        <span className="text-pencil">{panels[selected].aside}</span>
      </div>
      <div
        id={panelId(selected)}
        role="tabpanel"
        aria-labelledby={tabId(selected)}
      >
        {panels[selected].content}
      </div>
    </section>
  );
};

export default StandingsAndQuests;
