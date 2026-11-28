import { useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { addDays, format } from 'date-fns';
import { faBrush, faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import {
  eventOnDay,
  useAIPersonalities,
  useAdminEvents,
  useAdminPrompts,
  useSetPromptJudge,
} from '../api';
import {
  AdminModal,
  JudgeChip,
  JudgePicker,
  NewPrompt,
  PromptDraft,
  autoJudgeFor,
} from '../components/PromptDraft';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Swatches,
  Table,
  Tag,
  formatDay,
  td,
  th,
} from '../components/ui';
import type { AIPersonality, AdminEvent, AdminPrompt } from '../api';
import type { Calendar } from '../components/PromptDraft';
import type { User } from '@/api/Api';
import { useCreatePrompt } from '@/api/Api';
import Button from '@/components/Button';
import EventIcon from '@/events/EventIcon';
import { pencilsFor } from '@/drawing/pencils';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

/** How far ahead the schedule shows empty days */
const SCHEDULE_DAYS = 30;

/** A day's pencils then its paper, so added pencils show up in the list too */
const swatchColors = (prompt: AdminPrompt) => [
  ...pencilsFor(prompt).map((pencil) => pencil.color),
  ...prompt.colors.slice(3, 4),
];

type Editing = { day: string; prompt?: AdminPrompt };

const Author = ({ user }: { user: User | null }) =>
  user ? (
    <span className="flex items-center gap-2">
      <UserProfileIcon user={user} size="sm" />
      {user.username}
    </span>
  ) : (
    <span className="text-pencil">–</span>
  );

/** Every YYYY-MM-DD day from first to last, inclusive */
function daysBetween(first: string, last: string) {
  const days: Array<string> = [];
  for (
    let day = new Date(`${first}T00:00:00`);
    format(day, 'yyyy-MM-dd') <= last;
    day = addDays(day, 1)
  ) {
    days.push(format(day, 'yyyy-MM-dd'));
  }
  return days;
}

const PromptsPage = () => {
  const prompts = useAdminPrompts();
  const events = useAdminEvents();
  const { event: eventSlug } = useSearch({ from: '/draw/admin/prompts' });
  const { promptSuggestions } = useAdminDashboard();
  const judges = useAIPersonalities().data ?? [];
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pickingJudge, setPickingJudge] = useState<AdminPrompt | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');
  const eventList = events.data ?? [];
  const event = eventList.find((e) => e.slug === eventSlug);
  const calendar: Calendar = {
    taken: new Set((prompts.data ?? []).map((p) => p.day)),
    events: eventList,
    firstDay: today,
  };

  const schedule = (days: Array<string>, byDay: Map<string, AdminPrompt>) => (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {days.map((day) => (
        <ScheduleDay
          key={day}
          day={day}
          prompt={byDay.get(day)}
          // Filtered to one event, every day would carry the same tag
          event={event ? undefined : eventOnDay(eventList, day)}
          autoJudge={autoJudgeFor(judges, eventOnDay(eventList, day))}
          isToday={day === today}
          judges={judges}
          onEdit={setEditing}
          onPickJudge={setPickingJudge}
        />
      ))}
    </ul>
  );

  return (
    <AdminPage
      title="prompts"
      subtitle="the daily schedule, what people drew, and what they suggested"
      actions={
        <nav className="flex flex-wrap gap-2">
          <Link to="/draw/admin/prompts" search={{}}>
            <Tag className={cn(!event && 'bg-butter')}>all prompts</Tag>
          </Link>
          {eventList.map((e) => (
            <Link
              key={e.id}
              to="/draw/admin/prompts"
              search={{ event: e.slug }}
            >
              <Tag className={cn(e.slug === eventSlug && 'bg-butter')}>
                <EventIcon theme={e.theme} name={e.name} size={16} />
                {e.name}
              </Tag>
            </Link>
          ))}
        </nav>
      }
    >
      <Loaded query={prompts}>
        {(list) => {
          const byDay = new Map(list.map((p) => [p.day, p]));

          if (event) {
            const days = daysBetween(event.firstDay, event.lastDay);
            const drawn = days.reduce(
              (sum, d) => sum + (byDay.get(d)?.submissions ?? 0),
              0,
            );
            return (
              <Section
                title={`${formatDay(event.firstDay)} → ${formatDay(event.lastDay)}`}
                aside={
                  <span className="flex gap-4">
                    {days.filter((d) => byDay.has(d)).length}/{days.length} days
                    have prompts · {drawn} drawings
                    <Link to="/draw/admin/events" className="underline">
                      event report →
                    </Link>
                  </span>
                }
              >
                {schedule(days, byDay)}
              </Section>
            );
          }

          // At least SCHEDULE_DAYS ahead, or up to the last day with a prompt
          const lastScheduled = list[0]?.day ?? today;
          const horizon = format(
            addDays(new Date(), SCHEDULE_DAYS - 1),
            'yyyy-MM-dd',
          );
          const upcoming = daysBetween(
            today,
            lastScheduled > horizon ? lastScheduled : horizon,
          );
          const past = list.filter((p) => p.day < today);

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <Section title="write your own" className="lg:col-span-3">
                <NewPrompt calendar={calendar} />
              </Section>

              <Section
                title="upcoming"
                aside={`${upcoming.filter((d) => byDay.has(d)).length}/${upcoming.length} scheduled`}
                className="lg:col-span-2"
              >
                {schedule(upcoming, byDay)}
              </Section>

              <Section
                title="suggestions"
                aside={
                  <Link to="/draw/admin/suggestions" className="underline">
                    {promptSuggestions?.length ?? 0} waiting · schedule them →
                  </Link>
                }
              >
                <Panel className="flex flex-col divide-y divide-line">
                  {promptSuggestions?.length ? (
                    promptSuggestions.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-3">
                        <UserProfileIcon user={s.createdBy} size="sm" />
                        <span className="flex-1">{s.prompt}</span>
                      </div>
                    ))
                  ) : (
                    <p className="p-3 text-pencil">no suggestions yet</p>
                  )}
                </Panel>
              </Section>

              <Section
                title="past prompts"
                aside={`${past.length} days`}
                className="lg:col-span-3"
              >
                <Table
                  head={
                    <>
                      <th className={th}>day</th>
                      <th className={th}>prompt</th>
                      <th className={th}>colors</th>
                      <th className={th}>suggested by</th>
                      <th className={th}>drawings</th>
                      <th className={th} />
                    </>
                  }
                >
                  {past.map((p) => (
                    <tr key={p.day}>
                      <td className={cn(td, 'whitespace-nowrap')}>
                        {formatDay(p.day)}
                      </td>
                      <td className={td}>
                        <span className="flex items-center gap-2">
                          {p.prompt}
                          <EventMark event={eventOnDay(eventList, p.day)} />
                        </span>
                      </td>
                      <td className={td}>
                        <Swatches colors={swatchColors(p)} />
                      </td>
                      <td className={td}>
                        <Author user={p.createdBy} />
                      </td>
                      <td className={td}>{p.submissions}</td>
                      <td className={td}>
                        <TryIt day={p.day} />
                      </td>
                    </tr>
                  ))}
                </Table>
              </Section>
            </div>
          );
        }}
      </Loaded>

      {editing && (
        <EditPrompt
          editing={editing}
          calendar={calendar}
          onClose={() => setEditing(null)}
        />
      )}
      {pickingJudge && (
        <QuickJudgePicker
          prompt={pickingJudge}
          judges={judges}
          event={eventOnDay(eventList, pickingJudge.day)}
          onClose={() => setPickingJudge(null)}
        />
      )}
    </AdminPage>
  );
};

/** Adds or edits one day's prompt with the prompt maker, keeping who it's credited to */
const EditPrompt = ({
  editing: { day, prompt },
  calendar,
  onClose,
}: {
  editing: Editing;
  calendar: Calendar;
  onClose: () => void;
}) => {
  const create = useCreatePrompt();
  return (
    <AdminModal
      title={prompt ? 'edit prompt' : 'add prompt'}
      onClose={onClose}
      className="max-w-3xl"
    >
      <PromptDraft
        calendar={calendar}
        fixedDay={day}
        initialPrompt={prompt?.prompt}
        initialColors={prompt?.colors}
        initialPencils={prompt?.pencils}
        initialJudgeId={prompt?.judgeId ?? null}
        initialAIContext={prompt?.aiContext}
        suggester={prompt?.createdBy ?? undefined}
        scheduleLabel={prompt ? 'save' : 'add'}
        className="shadow-none"
        onSchedule={async ({ judgeId, ...draft }) => {
          await create.mutateAsync({
            ...draft,
            createdBy: prompt?.createdBy?.id,
            judgeId: judgeId ?? '',
          });
          onClose();
        }}
      />
    </AdminModal>
  );
};

/** Swaps a scheduled day's AI judge in one click */
const QuickJudgePicker = ({
  prompt,
  judges,
  event,
  onClose,
}: {
  prompt: AdminPrompt;
  judges: Array<AIPersonality>;
  event?: AdminEvent;
  onClose: () => void;
}) => {
  const setJudge = useSetPromptJudge();
  return (
    <JudgePicker
      day={prompt.day}
      judges={judges}
      value={prompt.judgeId}
      auto={autoJudgeFor(judges, event)}
      saving={setJudge.isPending}
      error={setJudge.error?.message}
      onPick={(judgeId) => {
        if (judgeId === prompt.judgeId) return onClose();
        setJudge.mutate({ day: prompt.day, judgeId }, { onSuccess: onClose });
      }}
      onClose={onClose}
    />
  );
};

/** The icon of the event a prompt's day falls in; links to that event's prompts */
const EventMark = ({ event }: { event?: AdminEvent }) =>
  event ? (
    <Link
      to="/draw/admin/prompts"
      search={{ event: event.slug }}
      className="transition-[scale] hover:scale-125"
    >
      <EventIcon theme={event.theme} name={event.name} />
    </Link>
  ) : null;

/** Opens the drawing canvas tab on this day's prompt, as players will see it */
const TryIt = ({ day }: { day: string }) => (
  <Link
    to="/draw/admin/drawing"
    search={{ day }}
    className="text-sm underline whitespace-nowrap"
  >
    <FontAwesomeIcon icon={faBrush} /> try it
  </Link>
);

const ScheduleDay = ({
  day,
  prompt,
  event,
  isToday,
  judges,
  autoJudge,
  onEdit,
  onPickJudge,
}: {
  day: string;
  prompt?: AdminPrompt;
  event?: AdminEvent;
  isToday: boolean;
  judges: Array<AIPersonality>;
  /** Who judges the day when no one was picked */
  autoJudge?: AIPersonality;
  onEdit: (editing: Editing) => void;
  onPickJudge: (picked: AdminPrompt) => void;
}) => (
  <li
    className={cn(
      'flex items-center gap-3 p-3 border-2 rounded-sketch-alt',
      prompt ? 'bg-white border-ink' : 'border-dashed border-coral',
      isToday && 'ring-4 ring-butter',
    )}
  >
    <div className="flex flex-col flex-1 min-w-0 gap-1">
      <span className="flex items-center gap-2 text-sm text-pencil">
        {formatDay(day)}
        {isToday && ' · today'}
        <EventMark event={event} />
      </span>
      {prompt ? (
        <>
          <span className="font-accent font-bold text-xl leading-none truncate">
            {prompt.prompt}
          </span>
          <span className="flex items-center gap-2">
            <Swatches colors={swatchColors(prompt)} />
            {prompt.createdBy && (
              <span className="text-sm text-pencil">
                by {prompt.createdBy.username}
              </span>
            )}
            {prompt.submissions > 0 && (
              <span className="text-sm text-pencil">
                · {prompt.submissions} drawn
              </span>
            )}
            <TryIt day={day} />
          </span>
          {judges.length > 0 && (
            <span className="flex min-w-0">
              <JudgeChip
                judge={
                  prompt.judgeId
                    ? judges.find((j) => j.id === prompt.judgeId)
                    : autoJudge
                }
                picked={!!prompt.judgeId}
                onClick={() => onPickJudge(prompt)}
              />
            </span>
          )}
        </>
      ) : (
        <span className="text-coral">no prompt yet</span>
      )}
    </div>
    <Button
      size="sm"
      variant="base"
      disableLoad
      icon={prompt ? faPen : faPlus}
      onClick={() => onEdit({ day, prompt })}
    >
      {prompt ? 'edit' : 'add'}
    </Button>
  </li>
);

export default PromptsPage;
