import { useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  useAdminPrompts,
  useAdminRedos,
  useAdminUsers,
  useGrantRedos,
  usePlayerDays,
  useRevokeRedo,
} from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Swatches,
  Table,
  Tag,
  formatDateTime,
  formatDay,
  promptWindow,
  td,
  th,
} from '../components/ui';
import { inputClass } from '../components/aiJudgeForm';
import type { AdminRedoGrant, AdminUser, PlayerDay } from '../api';
import type { FC, FormEvent } from 'react';
import { useAppSettings, useUpdateAppSettings } from '@/api/appSettings';
import Button from '@/components/Button';
import { isSameDay } from '@/days';
import { cn } from '@/utils';

const STATUS: Record<
  PlayerDay['status'],
  { label: string; className?: string }
> = {
  drawn: { label: 'drew it' },
  late: { label: 'drew it late' },
  redo: { label: 'redid it', className: 'bg-butter' },
  missed: { label: 'missed', className: 'bg-coral/20' },
};

/** The day before `day`, both YYYY-MM-DD */
const dayBefore = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

/** Whose redos the page is about; everyone's when none is picked */
const PlayerPicker: FC<{
  users: Array<AdminUser>;
  value: string | undefined;
  onChange: (userId: string | undefined) => void;
}> = ({ users, value, onChange }) => (
  <label className="flex flex-col gap-1 w-full sm:w-72">
    <span className="font-bold">player</span>
    <select
      className={inputClass}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">everyone</option>
      {[...users]
        .sort((a, b) => a.username.localeCompare(b.username))
        .map((user) => (
          <option key={user.id} value={user.id}>
            {user.username}
          </option>
        ))}
    </select>
  </label>
);

/** Opens a day's prompt on the drawing canvas tab, as players saw it */
const PromptLink: FC<{ day: string }> = ({ day }) => (
  <Link
    to="/draw/admin/drawing"
    search={{ day: day.slice(0, 10) }}
    className="text-sm underline whitespace-nowrap"
  >
    open prompt
  </Link>
);

/** One past prompt for a player: tap it to give or take back a redo for it */
const DayRow: FC<{
  userId: string;
  day: PlayerDay;
  /** An unused redo kept for exactly this day */
  waiting?: AdminRedoGrant;
  open: boolean;
  onToggle: () => void;
}> = ({ userId, day, waiting, open, onToggle }) => {
  const grant = useGrantRedos();
  const revoke = useRevokeRedo();
  const [note, setNote] = useState('');
  const status = STATUS[day.status];

  function give(event: FormEvent) {
    event.preventDefault();
    grant.mutate(
      { userId, day: day.day, note: note.trim(), count: 1 },
      { onSuccess: () => setNote('') },
    );
  }

  return (
    <li>
      <Panel
        className={cn(
          'flex flex-col',
          day.status !== 'missed' && 'border-line',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left cursor-pointer"
        >
          <span className="flex flex-col w-60 flex-none">
            <span className="font-bold">{formatDay(day.day)}</span>
            <span className="text-sm text-pencil whitespace-nowrap">
              live {promptWindow(day.day)}
            </span>
          </span>
          <span className="flex items-center gap-2 flex-1 min-w-48">
            <Swatches colors={day.colors} size="size-3" />
            <span className="font-accent font-bold text-xl leading-tight">
              {day.prompt.toLowerCase()}
            </span>
          </span>
          <span className="flex flex-wrap gap-1">
            <Tag className={status.className}>{status.label}</Tag>
            {waiting && <Tag className="bg-butter">redo waiting</Tag>}
          </span>
        </button>

        {open && (
          <div className="flex flex-col gap-3 px-4 pb-4 border-t border-line pt-3">
            {day.status !== 'missed' ? (
              <p className="text-pencil">
                They drew this one, so there's nothing to redo.{' '}
                <PromptLink day={day.day} />
              </p>
            ) : waiting ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-pencil">
                  A redo is waiting for this prompt
                  {waiting.note && `: ${waiting.note}`}.
                </span>
                <Button
                  size="sm"
                  variant="base"
                  disableLoad
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(waiting.id)}
                >
                  take back
                </Button>
                <PromptLink day={day.day} />
              </div>
            ) : (
              <form onSubmit={give} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 flex-1 min-w-56">
                  <span className="font-bold">note</span>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="why, e.g. the app ate it"
                    value={note}
                    maxLength={120}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <Button
                  type="submit"
                  size="sm"
                  disableLoad
                  disabled={grant.isPending}
                >
                  give a redo for “{day.prompt.toLowerCase()}”
                </Button>
                <PromptLink day={day.day} />
              </form>
            )}
            {(grant.isError || revoke.isError) && (
              <span className="text-coral">
                {(grant.error ?? revoke.error)?.message}
              </span>
            )}
          </div>
        )}
      </Panel>
    </li>
  );
};

/** A player's past prompts since they joined, missed ones first in mind */
const PlayerDays: FC<{ player: AdminUser; unused: Array<AdminRedoGrant> }> = ({
  player,
  unused,
}) => {
  const days = usePlayerDays(player.id);
  const [show, setShow] = useState<'missed' | 'all'>('missed');
  const [open, setOpen] = useState<string | null>(null);
  const anyDay = unused.filter((g) => !g.day).length;

  return (
    <Section
      title={`${player.username}'s prompts`}
      aside={
        anyDay > 0 &&
        `${anyDay} any-day redo${anyDay === 1 ? '' : 's'} waiting, good for any missed day`
      }
    >
      <Loaded query={days}>
        {({ days: list }) => {
          const missed = list.filter((d) => d.status === 'missed');
          const shown = show === 'missed' ? missed : list;
          return (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {(['missed', 'all'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setShow(option)}
                    className={cn(
                      'press px-3 py-1.5 border-2 border-ink rounded-sketch-alt cursor-pointer',
                      show === option ? 'bg-ink text-paper' : 'bg-white',
                    )}
                  >
                    {option === 'missed'
                      ? `missed (${missed.length})`
                      : `every day since joining (${list.length})`}
                  </button>
                ))}
                <span className="text-sm text-pencil">
                  tap a prompt to give a redo for it
                </span>
              </div>
              {shown.length === 0 ? (
                <p className="text-pencil">
                  {list.length === 0
                    ? 'No prompts have closed since they joined.'
                    : "They haven't missed a prompt since joining."}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {shown.map((day) => (
                    <DayRow
                      key={day.day}
                      userId={player.id}
                      day={day}
                      waiting={unused.find(
                        (g) => g.day && isSameDay(g.day, day.day),
                      )}
                      open={open === day.day}
                      onToggle={() =>
                        setOpen(open === day.day ? null : day.day)
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </Loaded>
    </Section>
  );
};

/** The prompt a picked date lands on, when it ran, and whether a redo can use it */
const PickedPrompt: FC<{ userId: string; day: string }> = ({ userId, day }) => {
  const prompts = useAdminPrompts();
  const days = usePlayerDays(userId);
  const prompt = prompts.data?.find((p) => isSameDay(p.day, day));
  const status = days.data?.days.find((d) => isSameDay(d.day, day))?.status;

  if (!prompts.data) return null;
  if (!prompt) {
    return <p className="text-coral">There was no prompt that day.</p>;
  }
  return (
    <p className="flex flex-col">
      <span className="flex items-center gap-2">
        <Swatches colors={prompt.colors} size="size-3" />
        <span className="font-accent font-bold text-xl leading-tight">
          {prompt.prompt.toLowerCase()}
        </span>
      </span>
      <span className="text-sm text-pencil">
        live {promptWindow(prompt.day)} · <PromptLink day={prompt.day} />
      </span>
      {status && status !== 'missed' && (
        <span className="text-coral">
          They already drew this one, so a redo for it won't show up.
        </span>
      )}
    </p>
  );
};

/** Hand the picked player redos: for any missed day, or a prompt picked by date */
const GrantForm: FC<{ userId: string }> = ({ userId }) => {
  const grant = useGrantRedos();
  const days = usePlayerDays(userId);
  const [kind, setKind] = useState<'any' | 'day'>('any');
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');
  const [count, setCount] = useState(1);
  const [sent, setSent] = useState<string | null>(null);

  const ready = kind === 'any' || day;
  // The newest prompt that has closed, on the server's clock
  const latest = days.data && dayBefore(days.data.today);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSent(null);
    const n = kind === 'day' ? 1 : count;
    grant.mutate(
      {
        userId,
        day: kind === 'day' ? day : null,
        note: note.trim(),
        count: n,
      },
      {
        onSuccess: () => {
          setSent(`Gave them ${n === 1 ? 'a redo' : `${n} redos`}`);
          setNote('');
        },
      },
    );
  }

  return (
    <Panel className="p-4">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-1">
          <legend className="font-bold mb-1">for</legend>
          <div className="flex flex-wrap gap-2">
            {(['any', 'day'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={cn(
                  'press px-3 py-2 border-2 border-ink rounded-sketch-alt cursor-pointer',
                  kind === option ? 'bg-ink text-paper' : 'bg-white',
                )}
              >
                {option === 'any' ? 'any missed day' : 'a prompt by date'}
              </button>
            ))}
          </div>
        </fieldset>

        {kind === 'day' ? (
          <label className="flex flex-col gap-1">
            <span className="font-bold">prompt date</span>
            <input
              type="date"
              className={inputClass}
              value={day}
              max={latest}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="font-bold">how many</span>
            <input
              type="number"
              min={1}
              max={10}
              className={inputClass}
              value={count}
              onChange={(e) =>
                setCount(Math.min(10, Math.max(1, Number(e.target.value))))
              }
            />
          </label>
        )}

        {kind === 'day' && day && (
          <div className="sm:col-span-2">
            <PickedPrompt userId={userId} day={day} />
          </div>
        )}

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-bold">note</span>
          <input
            type="text"
            className={inputClass}
            placeholder="why, e.g. the app ate it"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button
            type="submit"
            size="sm"
            disableLoad
            disabled={!ready || grant.isPending}
          >
            give redo
          </Button>
          {grant.isError && (
            <span className="text-coral">{grant.error.message}</span>
          )}
          {sent && !grant.isError && (
            <span className="text-pencil">{sent}</span>
          )}
        </div>
      </form>
    </Panel>
  );
};

/** Whether redone days count toward streaks, for everyone */
const StreakSetting = () => {
  const { data } = useAppSettings();
  const update = useUpdateAppSettings();
  const on = update.isPending
    ? !!update.variables.redosCountForStreaks
    : !!data?.redosCountForStreaks;

  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        className="mt-1 size-5 accent-ink"
        checked={on}
        disabled={!data || update.isPending}
        onChange={(e) =>
          update.mutate({ redosCountForStreaks: e.target.checked })
        }
      />
      <span className="flex flex-col">
        <span className="font-bold">redone days count toward streaks</span>
        <span className="text-pencil">
          Off: a redo puts the drawing on its day, but a broken streak stays
          broken. Finishing yesterday's doodle late always counts.
          {update.isError && (
            <span className="text-coral"> Couldn't save, try again.</span>
          )}
        </span>
      </span>
    </label>
  );
};

/** Every redo given, or just the picked player's */
const GivenTable: FC<{ list: Array<AdminRedoGrant> }> = ({ list }) => {
  const revoke = useRevokeRedo();
  if (list.length === 0) {
    return <p className="text-pencil">No redos given yet.</p>;
  }
  return (
    <Table
      head={
        <>
          <th className={th}>player</th>
          <th className={th}>for</th>
          <th className={th}>note</th>
          <th className={th}>given</th>
          <th className={th}>status</th>
          <th className={th} />
        </>
      }
    >
      {list.map((redo) => (
        <tr key={redo.id}>
          <td className={cn(td, 'font-bold')}>{redo.username}</td>
          <td className={td}>
            {redo.day ? formatDay(redo.day) : 'any missed day'}
          </td>
          <td className={cn(td, 'text-pencil')}>{redo.note || '–'}</td>
          <td className={td}>
            {formatDateTime(redo.createdAt)}
            {redo.grantedBy && (
              <span className="text-pencil"> by {redo.grantedBy}</span>
            )}
          </td>
          <td className={td}>
            {redo.usedAt ? (
              <Tag>used on {redo.usedDay ? formatDay(redo.usedDay) : '?'}</Tag>
            ) : (
              <Tag className="bg-butter">unused</Tag>
            )}
          </td>
          <td className={td}>
            {!redo.usedAt && (
              <Button
                size="sm"
                variant="base"
                disableLoad
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(redo.id)}
              >
                take back
              </Button>
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
};

/** Redos: let players draw prompts they missed */
const RedosPage = () => {
  const { user: userId } = useSearch({ from: '/draw/admin/redos' });
  const navigate = useNavigate();
  const users = useAdminUsers();
  const redos = useAdminRedos();
  const player = users.data?.find((u) => u.id === userId);
  const theirs = (redos.data ?? []).filter(
    (r) => !userId || r.userId === userId,
  );

  return (
    <AdminPage
      title="redos"
      subtitle="Let a player draw a prompt they missed. Each redo is good for one drawing."
    >
      <PlayerPicker
        users={users.data ?? []}
        value={userId}
        onChange={(user) =>
          navigate({ to: '/draw/admin/redos', search: user ? { user } : {} })
        }
      />

      {player ? (
        <>
          <PlayerDays
            key={player.id}
            player={player}
            unused={theirs.filter((r) => !r.usedAt)}
          />
          <Section title="give a redo">
            <GrantForm key={player.id} userId={player.id} />
          </Section>
        </>
      ) : (
        <p className="text-pencil">
          Pick a player to see the prompts they missed and give them redos.
        </p>
      )}

      <Section title="streaks">
        <StreakSetting />
      </Section>

      <Section
        title={player ? `given to ${player.username}` : 'given'}
        aside={
          redos.data &&
          `${theirs.filter((r) => !r.usedAt).length} waiting to be used`
        }
      >
        <Loaded query={redos}>{() => <GivenTable list={theirs} />}</Loaded>
      </Section>
    </AdminPage>
  );
};

export default RedosPage;
