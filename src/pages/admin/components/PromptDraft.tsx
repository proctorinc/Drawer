import { useEffect, useRef, useState } from 'react';
import {
  faCalendarPlus,
  faCheck,
  faDice,
  faPlus,
  faTimes,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { eventOnDay, useAIPersonalities } from '../api';
import { nextOpenDay, openDays } from '../schedule';
import { generateRandomColors } from '../utils';
import { Panel, formatDay } from './ui';
import type { AIPersonality, AdminEvent } from '../api';
import type { FC, ReactNode } from 'react';
import type { User } from '@/api/Api';
import type { Pencil } from '@/drawing/pencils';
import {
  DEFAULT_PENCIL_SIZE,
  PENCIL_SIZES,
  isDefaultPencils,
  pencilButtonScale,
  pencilsFor,
} from '@/drawing/pencils';
import { useCreatePrompt } from '@/api/Api';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import Button from '@/components/Button';
import EventIcon from '@/events/EventIcon';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

type When = 'next' | 'random' | 'date';

/** Where a draft prompt lands: what the admin picked and the day it works out to */
export type Calendar = {
  /** Days that already have a prompt */
  taken: Set<string>;
  events: Array<AdminEvent>;
  /** "next open" and "random" look from here on: today. A picked date can be any day */
  firstDay: string;
};

export type Draft = {
  day: string;
  prompt: string;
  colors: Array<string>;
  /** The day's own pencils, or null for the usual three */
  pencils: Array<Pencil> | null;
  /** The AI judge picked for the day, or null for the event's or default judge */
  judgeId: string | null;
  /** Notes for the AI judge on how to read the prompt, or "" */
  aiContext: string;
};

/**
 * The standard shape of a prompt's notes for the AI judge. The judge reads them before scoring,
 * so they settle what counts as drawing the prompt.
 */
export const AI_CONTEXT_TEMPLATE = `What it means:


Counts:
- 

Doesn't count:
- 

Extra credit:
- `;

// Room on the toolbar; the server allows no more
const MAX_PENCILS = 6;

/**
 * What a prompt stores for its pencils and paper: its colors are the first three
 * pencils' (topped up from the old colors if there are fewer) then the paper, and
 * its pencils only when they aren't just the usual three.
 */
export function promptColors(
  pencils: Array<Pencil>,
  paper: string | undefined,
  fallback: Array<string>,
) {
  const base = [0, 1, 2].map(
    (i) => pencils.at(i)?.color ?? fallback.at(i) ?? pencils[0].color,
  );
  const colors = paper ? [...base, paper] : base;
  return {
    colors,
    pencils: isDefaultPencils(pencils, colors) ? null : pencils,
  };
}

const inputClass =
  'px-3 py-2 bg-white border-2 border-ink rounded-sketch-alt focus:outline-none focus:ring-2 focus:ring-butter';

/**
 * Who judges a day's doodles when no one was picked for it: the day's event's judge, else
 * the default one. Mirrors PickAIPersonality on the server.
 */
export function autoJudgeFor(
  judges: Array<AIPersonality>,
  event: AdminEvent | undefined,
) {
  return (
    (event && judges.find((j) => j.enabled && j.eventId === event.id)) ||
    judges.find((j) => j.enabled && j.isDefault)
  );
}

/**
 * The day's pencils, each a dab sized like its toolbar button that opens a color
 * picker, with a size under it; then the paper, drawn square
 */
export const PencilPicker: FC<{
  pencils: Array<Pencil>;
  paper: string | undefined;
  onChange: (pencils: Array<Pencil>, paper: string | undefined) => void;
}> = ({ pencils, paper, onChange }) => {
  const setPencil = (i: number, change: Partial<Pencil>) =>
    onChange(
      pencils.map((p, j) => (j === i ? { ...p, ...change } : p)),
      paper,
    );
  const swatch =
    'relative border-2 border-ink cursor-pointer overflow-hidden hover:scale-110 transition-[scale]';
  return (
    <div className="flex flex-wrap items-start gap-2">
      {pencils.map((pencil, i) => (
        <div
          key={i}
          className="group relative flex flex-col items-center gap-1"
        >
          <span className="grid place-items-center size-11">
            <label
              title={`pencil ${i + 1} ${pencil.color}`}
              className={cn(swatch, 'rounded-full')}
              style={{
                backgroundColor: pencil.color,
                width: `${36 * pencilButtonScale(pencil.size)}px`,
                height: `${36 * pencilButtonScale(pencil.size)}px`,
              }}
            >
              <input
                type="color"
                value={pencil.color}
                onChange={(e) => setPencil(i, { color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          </span>
          <select
            value={pencil.size}
            onChange={(e) => setPencil(i, { size: Number(e.target.value) })}
            aria-label={`Pencil ${i + 1} size`}
            className="text-xs bg-white border border-ink rounded px-0.5"
          >
            {PENCIL_SIZES.map(({ label, size }) => (
              <option key={size} value={size}>
                {label}
              </option>
            ))}
          </select>
          {pencils.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onChange(
                  pencils.filter((_, j) => j !== i),
                  paper,
                )
              }
              className="absolute -top-1 -right-1 hidden group-hover:grid place-items-center size-4 text-[10px] bg-white border border-ink rounded-full cursor-pointer"
              aria-label={`Remove pencil ${i + 1}`}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
      ))}
      {pencils.length < MAX_PENCILS && (
        <button
          type="button"
          onClick={() =>
            onChange(
              [...pencils, { color: '#2b2a33', size: DEFAULT_PENCIL_SIZE }],
              paper,
            )
          }
          className="grid place-items-center size-11 border-2 border-dashed border-ink rounded-full cursor-pointer hover:bg-butter"
          title="add a pencil"
          aria-label="Add a pencil"
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
      {paper && (
        <label
          title={`paper ${paper}`}
          className={cn(swatch, 'size-11 rounded-md')}
          style={{ backgroundColor: paper }}
        >
          <input
            type="color"
            value={paper}
            onChange={(e) => onChange(pencils, e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => {
          // New colors for the usual three and the paper; added pencils keep theirs
          const random = generateRandomColors();
          onChange(
            pencils.map((p, i) => (i < 3 ? { ...p, color: random[i] } : p)),
            paper ? random[3] : undefined,
          );
        }}
        className="grid place-items-center size-11 text-lg border-2 border-dashed border-ink rounded-full cursor-pointer hover:bg-butter"
        title="random colors"
        aria-label="Random colors"
      >
        <FontAwesomeIcon icon={faDice} />
      </button>
    </div>
  );
};

const openModals: Array<symbol> = [];

/** A dimmed overlay holding a small panel; Escape or a click outside closes it */
export const AdminModal: FC<{
  title: ReactNode;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}> = ({ title, onClose, className, children }) => {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    // Modals open inside modals: Escape closes only the top one
    const id = Symbol('modal');
    openModals.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openModals.at(-1) === id) close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      openModals.splice(openModals.indexOf(id), 1);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center p-4 bg-ink/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex flex-col gap-3 w-full max-w-sm max-h-full overflow-y-auto p-4 bg-paper border-2 border-ink rounded-sketch',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-accent font-bold text-2xl leading-none">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-pencil hover:text-ink"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/** Picks the AI judge for a day: one of the switched-on judges, or "auto" */
export const JudgePicker: FC<{
  day?: string;
  judges: Array<AIPersonality>;
  /** The picked judge's id, or null for auto */
  value: string | null;
  /** Who judges the day on auto */
  auto?: AIPersonality;
  onPick: (judgeId: string | null) => void;
  onClose: () => void;
  saving?: boolean;
  error?: string;
}> = ({ day, judges, value, auto, onPick, onClose, saving, error }) => {
  const options: Array<{
    id: string | null;
    judge?: AIPersonality;
    label: ReactNode;
  }> = [
    {
      id: null,
      judge: auto,
      label: (
        <>
          <b>auto</b>
          <span className="text-pencil">
            {auto ? ` · ${auto.name}` : ' · no judge is on'}
          </span>
        </>
      ),
    },
    ...judges
      .filter((j) => j.enabled || j.id === value)
      .map((j) => ({
        id: j.id,
        judge: j,
        label: (
          <>
            <b>{j.name}</b>
            {!j.enabled && <span className="text-coral"> · switched off</span>}
          </>
        ),
      })),
  ];

  return (
    <AdminModal
      title={day ? `judge for ${formatDay(day)}` : 'judge'}
      onClose={onClose}
    >
      <p className="text-sm text-pencil">
        Auto is the event's judge during an event, else the default judge.
      </p>
      <ul className="flex flex-col gap-1">
        {options.map((o) => {
          const picked = o.id === value;
          return (
            <li key={o.id ?? 'auto'}>
              <button
                type="button"
                disabled={saving}
                onClick={() => onPick(o.id)}
                className={cn(
                  'flex items-center gap-3 w-full p-2 text-left border-2 rounded-sketch-alt cursor-pointer disabled:cursor-wait',
                  picked
                    ? 'bg-butter border-ink'
                    : 'bg-white border-transparent hover:border-ink',
                )}
              >
                {o.judge ? (
                  <AIJudgeAvatar judge={o.judge} size="sm" />
                ) : (
                  <span className="size-9 rounded-full border-2 border-dashed border-ink" />
                )}
                <span className="flex-1 min-w-0 truncate">{o.label}</span>
                {picked && <FontAwesomeIcon icon={faCheck} />}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <span className="text-coral">{error}</span>}
    </AdminModal>
  );
};

/** A small button showing a day's judge; "auto" when none was picked */
export const JudgeChip: FC<{
  judge?: AIPersonality;
  picked: boolean;
  onClick: () => void;
}> = ({ judge, picked, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={picked ? 'picked judge · change' : 'auto judge · change'}
    className={cn(
      'flex items-center gap-1.5 max-w-full py-0.5 pl-0.5 pr-2 text-sm border-2 rounded-full cursor-pointer hover:bg-butter',
      picked ? 'bg-sky/40 border-ink' : 'border-dashed border-pencil',
    )}
  >
    {judge ? (
      <AIJudgeAvatar judge={judge} size="xs" />
    ) : (
      <span className="size-5 rounded-full border-[1.5px] border-dashed border-ink" />
    )}
    <span className="truncate">
      {!picked && <span className="text-pencil">auto · </span>}
      {judge?.name ?? 'no judge'}
    </span>
  </button>
);

/** A prompt being edited and scheduled: from a suggestion, written from scratch, or a day's */
export const PromptDraft: FC<{
  calendar: Calendar;
  initialPrompt?: string;
  initialColors?: Array<string>;
  initialPencils?: Array<Pencil> | null;
  initialJudgeId?: string | null;
  initialAIContext?: string;
  /** Editing this day's prompt: no picking where it goes */
  fixedDay?: string;
  suggester?: User;
  scheduleLabel: string;
  onSchedule: (draft: Draft) => Promise<unknown>;
  onDismiss?: () => void;
  className?: string;
}> = ({
  calendar,
  initialPrompt = '',
  initialColors,
  initialPencils,
  initialJudgeId = null,
  initialAIContext = '',
  fixedDay,
  suggester,
  scheduleLabel,
  onSchedule,
  onDismiss,
  className,
}) => {
  const { taken, events, firstDay } = calendar;
  const judges = useAIPersonalities().data ?? [];
  const [prompt, setPrompt] = useState(initialPrompt);
  // The colors it started with, for topping up if pencils are taken away
  const [startColors] = useState(() =>
    initialColors?.length ? initialColors : generateRandomColors(),
  );
  const [pencils, setPencils] = useState(() =>
    pencilsFor({ colors: startColors, pencils: initialPencils }),
  );
  const [paper, setPaper] = useState(startColors.at(3));
  const [judgeId, setJudgeId] = useState(initialJudgeId);
  const [pickingJudge, setPickingJudge] = useState(false);
  const [aiContext, setAIContext] = useState(initialAIContext);
  const [showingAIContext, setShowingAIContext] = useState(!!initialAIContext);
  const [when, setWhen] = useState<When>('next');
  const [withinDays, setWithinDays] = useState(14);
  // A fixed roll, so the random day only changes when asked to
  const [roll, setRoll] = useState(Math.random);
  const [date, setDate] = useState(firstDay);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const randomChoices = openDays(taken, firstDay, withinDays);
  const day =
    fixedDay ??
    {
      next: nextOpenDay(taken, firstDay),
      random: randomChoices[Math.floor(roll * randomChoices.length)],
      date,
    }[when];

  let problem = '';
  if (!prompt.trim()) problem = 'write a prompt first';
  else if (!day) problem = `no open days in the next ${withinDays}`;
  // "next" and "random" only land on open days; a picked date replaces what's there
  const replacing = !fixedDay && !!day && taken.has(day);
  const event = day ? eventOnDay(events, day) : undefined;
  const auto = autoJudgeFor(judges, event);
  const judge = judgeId ? judges.find((j) => j.id === judgeId) : auto;

  const schedule = async () => {
    if (!day || problem) return;
    setSaving(true);
    setError('');
    try {
      await onSchedule({
        day,
        prompt: prompt.trim(),
        ...promptColors(pencils, paper, startColors),
        judgeId,
        // The template left as it was says nothing
        aiContext:
          aiContext.trim() === AI_CONTEXT_TEMPLATE.trim()
            ? ''
            : aiContext.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
      setSaving(false);
    }
  };

  return (
    <Panel
      className={cn(
        'grid grid-cols-1 md:grid-cols-[1fr_auto] gap-x-6 gap-y-3 p-4',
        className,
      )}
    >
      <div className="flex flex-col gap-3 min-w-0">
        {suggester && (
          <span className="flex items-center gap-2 text-pencil">
            <UserProfileIcon user={suggester} size="sm" />
            suggested by <b className="text-ink">{suggester.username}</b>
          </span>
        )}
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="a goose in a top hat"
          aria-label="Prompt"
          className={cn(inputClass, 'font-accent font-bold text-2xl')}
        />
        <PencilPicker
          pencils={pencils}
          paper={paper}
          onChange={(nextPencils, nextPaper) => {
            setPencils(nextPencils);
            setPaper(nextPaper);
          }}
        />
        {judges.length > 0 && (
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-pencil">judged by</span>
            <JudgeChip
              judge={judge}
              picked={!!judgeId}
              onClick={() => setPickingJudge(true)}
            />
          </span>
        )}
        {showingAIContext ? (
          <label className="flex flex-col gap-1">
            <span className="text-pencil">
              notes for the AI judge: what the prompt means, what counts
            </span>
            <textarea
              value={aiContext}
              onChange={(e) => setAIContext(e.target.value)}
              rows={10}
              className={cn(inputClass, 'font-mono text-sm')}
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAIContext(AI_CONTEXT_TEMPLATE);
              setShowingAIContext(true);
            }}
            className="self-start underline cursor-pointer text-pencil"
          >
            <FontAwesomeIcon icon={faPlus} /> notes for the AI judge
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 w-full md:w-80">
        {!fixedDay && (
          <div className="flex rounded-sketch-alt border-2 border-ink overflow-hidden">
            {(
              [
                ['next', 'next open'],
                ['random', 'random'],
                ['date', 'pick a day'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setWhen(value)}
                className={cn(
                  'flex-1 py-1 cursor-pointer border-l-2 border-ink first:border-l-0',
                  when === value ? 'bg-butter font-bold' : 'bg-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!fixedDay && when === 'random' && (
          <label className="flex items-center gap-2">
            within
            <input
              type="number"
              min={1}
              max={365}
              value={withinDays}
              onChange={(e) =>
                setWithinDays(Math.max(1, Number(e.target.value)))
              }
              className={cn(inputClass, 'w-20 py-1')}
            />
            days
            <button
              type="button"
              onClick={() => setRoll(Math.random())}
              className="ml-auto underline cursor-pointer"
            >
              <FontAwesomeIcon icon={faDice} /> re-roll
            </button>
          </label>
        )}
        {!fixedDay && when === 'date' && (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn(inputClass, 'py-1')}
          />
        )}
        <span
          className={cn(
            'flex items-center gap-2 min-h-7',
            problem ? 'text-coral' : 'font-bold',
          )}
        >
          {problem ||
            (day && (
              <>
                {fixedDay ? '' : '→ '}
                {formatDay(day)}
                {replacing && (
                  <span className="font-normal text-coral">
                    replaces that day's prompt
                  </span>
                )}
              </>
            ))}
          {!problem && event && (
            <EventIcon theme={event.theme} name={event.name} />
          )}
        </span>
        {error && <span className="text-coral">{error}</span>}
        <div className="flex gap-2">
          <Button
            size="sm"
            icon={faCalendarPlus}
            disableLoad
            disabled={!!problem || saving}
            onClick={schedule}
            className="flex-1"
          >
            {scheduleLabel}
          </Button>
          {onDismiss && (
            <Button
              size="sm"
              variant="base"
              icon={faTrash}
              disableLoad
              disabled={saving}
              onClick={onDismiss}
              aria-label="Dismiss suggestion"
              title="dismiss"
            />
          )}
        </div>
      </div>

      {pickingJudge && (
        <JudgePicker
          day={day}
          judges={judges}
          value={judgeId}
          auto={auto}
          onPick={(id) => {
            setJudgeId(id);
            setPickingJudge(false);
          }}
          onClose={() => setPickingJudge(false)}
        />
      )}
    </Panel>
  );
};

/** A fresh prompt; remounted after each one is added so the form clears */
export const NewPrompt: FC<{ calendar: Calendar }> = ({ calendar }) => {
  const create = useCreatePrompt();
  const [added, setAdded] = useState(0);
  return (
    <PromptDraft
      key={added}
      calendar={calendar}
      scheduleLabel="add"
      onSchedule={async ({ judgeId, ...draft }) => {
        await create.mutateAsync({ ...draft, judgeId: judgeId ?? '' });
        setAdded((n) => n + 1);
      }}
    />
  );
};
