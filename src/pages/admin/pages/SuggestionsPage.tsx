import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  faCalendarPlus,
  faDice,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import {
  eventOnDay,
  useAcceptSuggestion,
  useAdminEvents,
  useAdminPrompts,
  useDismissSuggestion,
} from '../api';
import { AdminPage, Loaded, Panel, Section, formatDay } from '../components/ui';
import { dayAfter, nextOpenDay, openDays, toDay } from '../schedule';
import { generateRandomColors } from '../utils';
import type { AdminEvent } from '../api';
import type { FC } from 'react';
import type { PromptSuggestion, User } from '@/api/Api';
import { useCreatePrompt } from '@/api/Api';
import Button from '@/components/Button';
import EventIcon from '@/events/EventIcon';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

type When = 'next' | 'random' | 'date';

/** Where a draft prompt lands: what the admin picked and the day it works out to */
type Calendar = {
  /** Days that already have a prompt */
  taken: Set<string>;
  events: Array<AdminEvent>;
  /** Prompts are scheduled from here on: tomorrow */
  firstDay: string;
};

const inputClass =
  'px-3 py-2 bg-white border-2 border-ink rounded-sketch-alt focus:outline-none focus:ring-2 focus:ring-butter';

/** One swatch per color, each opening a color picker */
const ColorPicker: FC<{
  colors: Array<string>;
  onChange: (colors: Array<string>) => void;
}> = ({ colors, onChange }) => (
  <div className="flex items-center gap-2">
    {colors.map((color, i) => (
      <label
        key={i}
        title={i === 3 ? `paper ${color}` : `color ${i + 1} ${color}`}
        className={cn(
          'relative size-9 border-2 border-ink cursor-pointer overflow-hidden hover:scale-110 transition-[scale]',
          // The fourth color is the paper, drawn square to tell it apart
          i === 3 ? 'rounded-md' : 'rounded-full',
        )}
        style={{ backgroundColor: color }}
      >
        <input
          type="color"
          value={color}
          onChange={(e) =>
            onChange(colors.map((c, j) => (j === i ? e.target.value : c)))
          }
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
    ))}
    <button
      type="button"
      onClick={() => onChange(generateRandomColors())}
      className="grid place-items-center size-9 text-lg border-2 border-dashed border-ink rounded-full cursor-pointer hover:bg-butter"
      title="random colors"
      aria-label="Random colors"
    >
      <FontAwesomeIcon icon={faDice} />
    </button>
  </div>
);

/** A prompt being edited and scheduled: from a suggestion, or written from scratch */
const PromptDraft: FC<{
  calendar: Calendar;
  initialPrompt?: string;
  suggester?: User;
  scheduleLabel: string;
  onSchedule: (draft: {
    day: string;
    prompt: string;
    colors: Array<string>;
  }) => Promise<unknown>;
  onDismiss?: () => void;
}> = ({
  calendar,
  initialPrompt = '',
  suggester,
  scheduleLabel,
  onSchedule,
  onDismiss,
}) => {
  const { taken, events, firstDay } = calendar;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [colors, setColors] = useState(generateRandomColors);
  const [when, setWhen] = useState<When>('next');
  const [withinDays, setWithinDays] = useState(14);
  // A fixed roll, so the random day only changes when asked to
  const [roll, setRoll] = useState(Math.random);
  const [date, setDate] = useState(firstDay);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const randomChoices = openDays(taken, firstDay, withinDays);
  const day = {
    next: nextOpenDay(taken, firstDay),
    random: randomChoices[Math.floor(roll * randomChoices.length)],
    date,
  }[when];

  let problem = '';
  if (!prompt.trim()) problem = 'write a prompt first';
  else if (!day) problem = `no open days in the next ${withinDays}`;
  else if (day < firstDay) problem = 'pick a day in the future';
  else if (taken.has(day)) problem = 'that day already has a prompt';
  const event = day ? eventOnDay(events, day) : undefined;

  const schedule = async () => {
    if (!day || problem) return;
    setSaving(true);
    setError('');
    try {
      await onSchedule({ day, prompt: prompt.trim(), colors });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
      setSaving(false);
    }
  };

  return (
    <Panel className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 p-4">
      <div className="flex flex-col gap-3">
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
        <ColorPicker colors={colors} onChange={setColors} />
      </div>

      <div className="flex flex-col gap-2 w-80">
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
        {when === 'random' && (
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
        {when === 'date' && (
          <input
            type="date"
            min={firstDay}
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
          {problem || (day && <>→ {formatDay(day)}</>)}
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
    </Panel>
  );
};

const SuggestionDraft: FC<{
  suggestion: PromptSuggestion;
  calendar: Calendar;
}> = ({ suggestion, calendar }) => {
  const accept = useAcceptSuggestion();
  const dismiss = useDismissSuggestion();
  return (
    <PromptDraft
      calendar={calendar}
      initialPrompt={suggestion.prompt}
      suggester={suggestion.createdBy}
      scheduleLabel="accept"
      onSchedule={(draft) =>
        accept.mutateAsync({ id: suggestion.id, ...draft })
      }
      onDismiss={() => {
        if (
          window.confirm(`Dismiss "${suggestion.prompt}"? It can't be undone.`)
        ) {
          dismiss.mutate(suggestion.id);
        }
      }}
    />
  );
};

/** A fresh prompt; remounted after each one is added so the form clears */
const NewPrompt: FC<{ calendar: Calendar }> = ({ calendar }) => {
  const create = useCreatePrompt();
  const [added, setAdded] = useState(0);
  return (
    <PromptDraft
      key={added}
      calendar={calendar}
      scheduleLabel="add"
      onSchedule={async (draft) => {
        await create.mutateAsync(draft);
        setAdded((n) => n + 1);
      }}
    />
  );
};

const SuggestionsPage = () => {
  const { promptSuggestions } = useAdminDashboard();
  const prompts = useAdminPrompts();
  const events = useAdminEvents().data ?? [];

  return (
    <AdminPage
      title="suggestions"
      subtitle="tweak what players suggested, give it colors, and drop it on a day"
      actions={
        <Link to="/draw/admin/prompts" search={{}} className="underline">
          see the schedule →
        </Link>
      }
    >
      <Loaded query={prompts}>
        {(list) => {
          const calendar: Calendar = {
            taken: new Set(list.map((p) => p.day)),
            events,
            firstDay: dayAfter(toDay(new Date())),
          };
          return (
            <>
              <Section title="write your own">
                <NewPrompt calendar={calendar} />
              </Section>
              <Section
                title="from players"
                aside={`${promptSuggestions?.length ?? 0} waiting`}
              >
                {promptSuggestions?.length ? (
                  promptSuggestions.map((s) => (
                    <SuggestionDraft
                      key={s.id}
                      suggestion={s}
                      calendar={calendar}
                    />
                  ))
                ) : (
                  <p className="text-pencil">no suggestions waiting</p>
                )}
              </Section>
            </>
          );
        }}
      </Loaded>
    </AdminPage>
  );
};

export default SuggestionsPage;
