import { useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import {
  useAdminRedos,
  useAdminUsers,
  useGrantRedos,
  useRevokeRedo,
} from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Table,
  Tag,
  formatDateTime,
  formatDay,
  td,
  th,
} from '../components/ui';
import { inputClass } from '../components/aiJudgeForm';
import type { FC, FormEvent } from 'react';
import { useAppSettings, useUpdateAppSettings } from '@/api/appSettings';
import Button from '@/components/Button';
import { cn } from '@/utils';

/** Yesterday on this device's clock, the latest day a redo can be for */
const latestRedoDay = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString('en-CA');
};

/** Hand a player redos: for one missed day, or any day they missed */
const GrantForm: FC<{ initialUserId?: string }> = ({ initialUserId }) => {
  const users = useAdminUsers();
  const grant = useGrantRedos();
  const [userId, setUserId] = useState(initialUserId ?? '');
  const [kind, setKind] = useState<'any' | 'day'>('any');
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');
  const [count, setCount] = useState(1);
  const [sent, setSent] = useState<string | null>(null);

  const ready = userId && (kind === 'any' || day);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSent(null);
    grant.mutate(
      {
        userId,
        day: kind === 'day' ? day : null,
        note: note.trim(),
        count: kind === 'day' ? 1 : count,
      },
      {
        onSuccess: () => {
          const name = users.data?.find((u) => u.id === userId)?.username;
          setSent(
            `Gave ${name ?? 'them'} ${kind === 'day' || count === 1 ? 'a redo' : `${count} redos`}`,
          );
          setNote('');
        },
      },
    );
  }

  const sorted = [...(users.data ?? [])].sort((a, b) =>
    a.username.localeCompare(b.username),
  );

  return (
    <Panel className="p-4">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-bold">player</span>
          <select
            className={inputClass}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">pick someone…</option>
            {sorted.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
        </label>

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
                {option === 'any' ? 'any missed day' : 'a particular day'}
              </button>
            ))}
          </div>
        </fieldset>

        {kind === 'day' ? (
          <label className="flex flex-col gap-1">
            <span className="font-bold">day</span>
            <input
              type="date"
              className={inputClass}
              value={day}
              max={latestRedoDay()}
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

        <label className="flex flex-col gap-1">
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

/** Redos: let players draw prompts they missed */
const RedosPage = () => {
  const { user } = useSearch({ from: '/draw/admin/redos' });
  const redos = useAdminRedos();
  const revoke = useRevokeRedo();

  return (
    <AdminPage
      title="redos"
      subtitle="Let a player draw a prompt they missed. Each redo is good for one drawing."
    >
      <Section title="give a redo">
        <GrantForm initialUserId={user} />
      </Section>

      <Section title="streaks">
        <StreakSetting />
      </Section>

      <Section
        title="given"
        aside={
          redos.data &&
          `${redos.data.filter((r) => !r.usedAt).length} waiting to be used`
        }
      >
        <Loaded query={redos}>
          {(list) =>
            list.length === 0 ? (
              <p className="text-pencil">No redos given yet.</p>
            ) : (
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
                    <td className={cn(td, 'text-pencil')}>
                      {redo.note || '–'}
                    </td>
                    <td className={td}>
                      {formatDateTime(redo.createdAt)}
                      {redo.grantedBy && (
                        <span className="text-pencil">
                          {' '}
                          by {redo.grantedBy}
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      {redo.usedAt ? (
                        <Tag>
                          used on {redo.usedDay ? formatDay(redo.usedDay) : '?'}
                        </Tag>
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
            )
          }
        </Loaded>
      </Section>
    </AdminPage>
  );
};

export default RedosPage;
