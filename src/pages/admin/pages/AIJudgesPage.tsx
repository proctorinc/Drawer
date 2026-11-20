import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  faFloppyDisk,
  faPlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import {
  useAIPersonalities,
  useAIReviews,
  useAISettings,
  useAdminEvents,
  useDeleteAIPersonality,
  useSaveAIPersonality,
  useUpdateAISettings,
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
import {
  CriteriaEditor,
  ErrorText,
  Field,
  inputClass,
} from '../components/aiJudgeForm';
import { RerunAIButton } from '../components/RerunAIButton';
import type { FC } from 'react';
import type {
  AIPersonality,
  AISettings,
  AdminAIReview,
  AdminEvent,
} from '../api';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { AI_DECORATIONS } from '@/ai/decorations';
import { AI_SCORE_MAX, formatScore } from '@/ai/score';
import Button from '@/components/Button';
import { cn } from '@/utils';

const isLive = (event: AdminEvent, now = Date.now()) =>
  new Date(event.startsAt).getTime() <= now &&
  now < new Date(event.endsAt).getTime();

/** Who judges a doodle drawn right now, the way the server picks */
function judgeToday(
  personalities: Array<AIPersonality>,
  events: Array<AdminEvent>,
) {
  const live = events.filter((e) => isLive(e)).map((e) => e.id);
  return (
    personalities.find(
      (p) => p.enabled && p.eventId && live.includes(p.eventId),
    ) ?? personalities.find((p) => p.enabled && p.isDefault)
  );
}

// --- Connection ---

const ConnectionPanel: FC<{ settings: AISettings }> = ({ settings }) => {
  const update = useUpdateAISettings();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(settings.model);

  const keyHint = settings.keyFromEnv
    ? `using OPENAI_API_KEY from the server (${settings.apiKeyHint}); a key saved here wins`
    : settings.hasApiKey
      ? `saved key ${settings.apiKeyHint}; type a new one to replace it`
      : 'stored on the server and never sent back to the browser';

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <label className="flex items-center gap-3 text-lg">
        <input
          type="checkbox"
          className="size-5 accent-[var(--color-ink)]"
          checked={settings.enabled}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ enabled: e.target.checked })}
        />
        <span>
          <b>AI judges on</b>
          <span className="text-pencil">
            {' '}
            · new doodles get a score and a comment from today's judge. Off, new
            doodles get nothing and show no AI at all; reviews already written
            stay up.
          </span>
        </span>
      </label>
      {settings.enabled && !settings.hasApiKey && (
        <p className="text-coral">
          Judging is on, but nothing will happen until there's an OpenAI key.
        </p>
      )}
      <form
        className="grid grid-cols-[1fr_16rem_auto] gap-4 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(
            { model, ...(apiKey.trim() ? { apiKey } : {}) },
            { onSuccess: () => setApiKey('') },
          );
        }}
      >
        <Field label="OpenAI API key" hint={keyHint}>
          <input
            type="password"
            autoComplete="off"
            className={inputClass}
            placeholder={settings.hasApiKey ? '••••••••' : 'sk-…'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
        <Field label="model" hint="needs image input and structured outputs">
          <input
            className={inputClass}
            placeholder={settings.defaultModel}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </Field>
        <div className="flex gap-2 pb-6">
          <Button
            size="sm"
            icon={faFloppyDisk}
            type="submit"
            disableLoad
            disabled={update.isPending}
          >
            save
          </Button>
          {settings.hasApiKey && !settings.keyFromEnv && (
            <Button
              size="sm"
              variant="base"
              type="button"
              disableLoad
              onClick={() => {
                if (confirm('Remove the saved OpenAI key?')) {
                  update.mutate({ clearApiKey: true });
                }
              }}
            >
              remove key
            </Button>
          )}
        </div>
      </form>
      <ErrorText error={update.error} />
    </Panel>
  );
};

// --- Judges ---

const blankPersonality = (): AIPersonality => ({
  id: '',
  slug: '',
  name: '',
  bio: '',
  systemPrompt: '',
  avatarUrl: '',
  decoration: '',
  isDefault: false,
  eventId: null,
  enabled: true,
  criteria: [],
});

const JudgeCard: FC<{
  personality: AIPersonality;
  events: Array<AdminEvent>;
  judgingToday: boolean;
  onEdit: () => void;
}> = ({ personality: p, events, judgingToday, onEdit }) => {
  const event = events.find((e) => e.id === p.eventId);
  return (
    <Panel
      className={cn(
        'flex flex-col gap-3 p-4',
        !p.enabled && 'opacity-60 border-dashed',
      )}
    >
      <div className="flex items-start gap-4">
        <AIJudgeAvatar judge={p} size="xl" className="mt-2" />
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-accent font-bold text-2xl leading-none">
            {p.name}
          </h3>
          <p className="text-pencil">{p.bio}</p>
          <div className="flex flex-wrap gap-1">
            {judgingToday && <Tag className="bg-butter">judging today</Tag>}
            {p.isDefault && <Tag className="bg-sky">default</Tag>}
            {event && <Tag className="bg-blush">{event.name}</Tag>}
            {p.eventId && !event && <Tag>missing event</Tag>}
            {!p.enabled && <Tag>off</Tag>}
          </div>
        </div>
      </div>
      {p.criteria.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {p.criteria.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              {c.imageUrl && (
                <img
                  src={c.imageUrl}
                  alt=""
                  className="size-6 object-contain"
                />
              )}
              <b className="whitespace-nowrap">{c.name}</b>
              <span className="text-pencil truncate">· {c.description}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-pencil">one overall score, no criteria</p>
      )}
      <Button
        size="sm"
        variant="base"
        className="self-start"
        disableLoad
        onClick={onEdit}
      >
        edit
      </Button>
    </Panel>
  );
};

const JudgeEditor: FC<{
  initial: AIPersonality;
  events: Array<AdminEvent>;
  onDone: () => void;
}> = ({ initial, events, onDone }) => {
  const save = useSaveAIPersonality();
  const remove = useDeleteAIPersonality();
  const [p, setP] = useState(initial);
  const set = (patch: Partial<AIPersonality>) => setP({ ...p, ...patch });

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-4">
        <AIJudgeAvatar
          judge={{ ...p, name: p.name || '?' }}
          size="xl"
          className="mt-2"
        />
        <h3 className="font-accent font-bold text-3xl">
          {initial.id ? `edit ${initial.name}` : 'new judge'}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="name" hint="signed on every comment">
          <input
            className={inputClass}
            value={p.name}
            maxLength={40}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <Field
          label="about"
          hint="a sentence or two players read when they tap its face"
        >
          <textarea
            className={cn(inputClass, 'min-h-[2.75rem]')}
            rows={2}
            value={p.bio}
            maxLength={300}
            onChange={(e) => set({ bio: e.target.value })}
          />
        </Field>
        <Field
          label="profile picture"
          hint="a square image url, e.g. /ai/santa.svg"
        >
          <input
            className={inputClass}
            value={p.avatarUrl}
            onChange={(e) => set({ avatarUrl: e.target.value })}
          />
        </Field>
        <Field
          label="decoration"
          hint="AI-only, so it never looks like a player"
        >
          <select
            className={inputClass}
            value={p.decoration}
            onChange={(e) => set({ decoration: e.target.value })}
          >
            <option value="">none</option>
            {Object.entries(AI_DECORATIONS).map(([id, d]) => (
              <option key={id} value={id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="personality"
        hint="who it is and how it talks. Shared rules (stay PG, roast the doodle not the person, keep it under 30 words, answer in JSON) are added for you."
      >
        <textarea
          className={cn(inputClass, 'min-h-40 font-mono text-sm')}
          value={p.systemPrompt}
          onChange={(e) => set({ systemPrompt: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-3 gap-4 items-start">
        <Field label="event" hint="judges instead of the default while it runs">
          <select
            className={inputClass}
            value={p.eventId ?? ''}
            disabled={p.isDefault}
            onChange={(e) => set({ eventId: e.target.value || null })}
          >
            <option value="">no event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({formatDay(e.firstDay)})
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 pt-8">
          <input
            type="checkbox"
            className="size-5 accent-[var(--color-ink)]"
            checked={p.isDefault}
            onChange={(e) =>
              set({
                isDefault: e.target.checked,
                eventId: e.target.checked ? null : p.eventId,
              })
            }
          />
          default judge
        </label>
        <label className="flex items-center gap-2 pt-8">
          <input
            type="checkbox"
            className="size-5 accent-[var(--color-ink)]"
            checked={p.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          switched on
        </label>
      </div>
      <CriteriaEditor
        criteria={p.criteria}
        onChange={(criteria) => set({ criteria })}
      />
      <p className="text-pencil">
        Want to see how it reacts?{' '}
        <Link to="/draw/admin/ai/test" className="underline text-ink">
          Try it in the testing ground
        </Link>
        , where you can tweak its prompt and run it on any doodle, or your own,
        side by side with other judges.
      </p>
      <ErrorText error={save.error ?? remove.error} />
      <div className="flex gap-2">
        <Button
          size="sm"
          icon={faFloppyDisk}
          disableLoad
          disabled={save.isPending}
          onClick={() => save.mutate(p, { onSuccess: onDone })}
        >
          save
        </Button>
        <Button size="sm" variant="base" disableLoad onClick={onDone}>
          cancel
        </Button>
        {initial.id && (
          <Button
            size="sm"
            variant="base"
            icon={faTrash}
            className="ml-auto"
            disableLoad
            onClick={() => {
              if (confirm(`Delete ${initial.name}?`)) {
                remove.mutate(initial.id, { onSuccess: onDone });
              }
            }}
          >
            delete
          </Button>
        )}
      </div>
    </Panel>
  );
};

// --- Reviews ---

const STATUS_CLASS = {
  done: 'bg-butter',
  pending: 'bg-sky',
  failed: 'bg-blush',
} as const;

const ReviewRow: FC<{ review: AdminAIReview; canRun: boolean }> = ({
  review: r,
  canRun,
}) => {
  return (
    <tr>
      <td className={td}>
        {r.imageUrl && (
          <img
            src={r.imageUrl}
            alt={r.prompt}
            className="size-14 object-cover border-[1.5px] border-ink rounded bg-white"
          />
        )}
      </td>
      <td className={td}>
        <div className="font-bold">{r.prompt}</div>
        <div className="text-sm text-pencil">
          {r.artist.username} · {formatDay(r.day)}
        </div>
      </td>
      <td className={td}>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <AIJudgeAvatar judge={r.judge} />
          {r.judge.name}
        </span>
      </td>
      <td className={cn(td, 'font-accent font-bold text-xl whitespace-nowrap')}>
        {r.score !== null ? `${formatScore(r.score)}/${AI_SCORE_MAX}` : '–'}
      </td>
      <td className={cn(td, 'max-w-md')}>
        {r.status === 'failed' ? (
          <span className="text-coral">{r.error}</span>
        ) : (
          r.comment
        )}
      </td>
      <td className={td}>
        <Tag className={STATUS_CLASS[r.status]}>{r.status}</Tag>
        <div className="text-xs text-pencil mt-1 whitespace-nowrap">
          {formatDateTime(r.createdAt)}
          {r.model && ` · ${r.model}`}
        </div>
      </td>
      <td className={td}>
        {canRun && (
          <RerunAIButton
            submissionId={r.submissionId}
            personalityId={r.judge.id}
            judgeName={r.judge.name}
            artist={r.artist.username}
          />
        )}
      </td>
    </tr>
  );
};

// --- Page ---

/** The AI judges: who they are, what they score, and what they've said */
const AIJudgesPage = () => {
  const settings = useAISettings();
  const personalities = useAIPersonalities();
  const events = useAdminEvents();
  const reviews = useAIReviews();
  const [editing, setEditing] = useState<AIPersonality | null>(null);

  const canRun = !!settings.data?.hasApiKey;
  const today = judgeToday(personalities.data ?? [], events.data ?? []);

  return (
    <AdminPage
      title="ai judges"
      subtitle={
        settings.data?.enabled && canRun ? (
          today ? (
            <>
              <b>{today.name}</b> is judging today's doodles
            </>
          ) : (
            'judging is on, but no judge is switched on'
          )
        ) : (
          'judging is off: new doodles get no AI score or comment'
        )
      }
    >
      <Section title="connection">
        <Loaded query={settings}>
          {(data) => <ConnectionPanel settings={data} />}
        </Loaded>
      </Section>

      <Section
        title="judges"
        aside={
          !editing && (
            <Button
              size="sm"
              variant="base"
              icon={faPlus}
              disableLoad
              onClick={() => setEditing(blankPersonality())}
            >
              new judge
            </Button>
          )
        }
      >
        {editing ? (
          <JudgeEditor
            key={editing.id || 'new'}
            initial={editing}
            events={events.data ?? []}
            onDone={() => setEditing(null)}
          />
        ) : (
          <Loaded query={personalities}>
            {(list) => (
              <div className="grid grid-cols-2 gap-4">
                {list.map((p) => (
                  <JudgeCard
                    key={p.id}
                    personality={p}
                    events={events.data ?? []}
                    judgingToday={today?.id === p.id}
                    onEdit={() => setEditing(p)}
                  />
                ))}
              </div>
            )}
          </Loaded>
        )}
      </Section>

      <Section title="recent reviews" aside="the newest 100, failures included">
        <Loaded query={reviews}>
          {(list) =>
            list.length === 0 ? (
              <p className="text-pencil">no reviews yet</p>
            ) : (
              <Table
                head={
                  <>
                    <th className={th}></th>
                    <th className={th}>doodle</th>
                    <th className={th}>judge</th>
                    <th className={th}>score</th>
                    <th className={th}>comment</th>
                    <th className={th}>status</th>
                    <th className={th}></th>
                  </>
                }
              >
                {list.map((r) => (
                  <ReviewRow key={r.submissionId} review={r} canRun={canRun} />
                ))}
              </Table>
            )
          }
        </Loaded>
      </Section>
    </AdminPage>
  );
};

export default AIJudgesPage;
