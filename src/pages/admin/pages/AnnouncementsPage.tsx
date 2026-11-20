import { useState } from 'react';
import {
  useAdminAnnouncements,
  useDeleteAnnouncement,
  useResetAnnouncementViews,
  useSaveAnnouncement,
} from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Table,
  Tag,
  formatDateTime,
  td,
  th,
} from '../components/ui';
import { ErrorText, Field, inputClass } from '../components/aiJudgeForm';
import type { FC } from 'react';
import type { AdminAnnouncement, AnnouncementDraft } from '../api';
import type { AnnouncementArt } from '@/announcements/api';
import { ANNOUNCEMENT_ARTS } from '@/announcements/api';
import { useShowAnnouncements } from '@/announcements/AnnouncementWatcher';
import Button from '@/components/Button';
import { cn } from '@/utils';

const DAY = 86_400_000;

const ART_LABELS: Record<AnnouncementArt, string> = {
  none: 'the logo',
  ai_judges: "today's AI judge",
  christmas: 'christmas lights & tree',
  image: 'an image (URL below)',
};

type Status = 'draft' | 'scheduled' | 'live' | 'expired';

function statusOf(a: AnnouncementDraft, now = Date.now()): Status {
  if (!a.active) return 'draft';
  if (now < new Date(a.startsAt).getTime()) return 'scheduled';
  if (now < new Date(a.expiresAt).getTime()) return 'live';
  return 'expired';
}

const STATUS_COLORS: Record<Status, string> = {
  draft: 'bg-paper',
  scheduled: 'bg-sky',
  live: 'bg-butter',
  expired: 'bg-paper text-pencil',
};

/** ISO → the value a datetime-local input wants, in your own time zone */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (value: string) => new Date(value).toISOString();

function blankDraft(position: number): AnnouncementDraft {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  return {
    title: '',
    body: '',
    art: 'none',
    imageUrl: '',
    ctaLabel: '',
    ctaUrl: '',
    position,
    active: false,
    startsAt: start.toISOString(),
    expiresAt: new Date(start.getTime() + 30 * DAY).toISOString(),
  };
}

const Editor: FC<{
  initial: AnnouncementDraft;
  onClose: () => void;
}> = ({ initial, onClose }) => {
  const [draft, setDraft] = useState(initial);
  const save = useSaveAnnouncement();
  const show = useShowAnnouncements();
  const set = (patch: Partial<AnnouncementDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const submit = (active = draft.active) =>
    save.mutate({ ...draft, active }, { onSuccess: onClose });

  const preview = () =>
    show([{ ...draft, id: draft.id ?? 'preview' }], { preview: true });

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="title"
          hint="short and lowercase, like the rest of the app"
        >
          <input
            className={inputClass}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="meet the judges"
          />
        </Field>
        <Field label="art">
          <select
            className={inputClass}
            value={draft.art}
            onChange={(e) => set({ art: e.target.value as AnnouncementArt })}
          >
            {ANNOUNCEMENT_ARTS.map((art) => (
              <option key={art} value={art}>
                {ART_LABELS[art]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="body" hint="a blank line starts a new paragraph">
        <textarea
          className={cn(inputClass, 'min-h-32')}
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
        />
      </Field>

      {draft.art === 'image' && (
        <Field label="image URL">
          <input
            className={inputClass}
            value={draft.imageUrl}
            onChange={(e) => set({ imageUrl: e.target.value })}
            placeholder="https://… or /badges/…"
          />
        </Field>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="button label" hint="optional; leave both blank for none">
          <input
            className={inputClass}
            value={draft.ctaLabel}
            onChange={(e) => set({ ctaLabel: e.target.value })}
            placeholder="draw something"
          />
        </Field>
        <Field
          label="button link"
          hint="an in-app path (/draw, /draw/trophies) or an https:// link"
        >
          <input
            className={inputClass}
            value={draft.ctaUrl}
            onChange={(e) => set({ ctaUrl: e.target.value })}
            placeholder="/draw"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="shows from">
          <input
            type="datetime-local"
            className={inputClass}
            value={toLocalInput(draft.startsAt)}
            onChange={(e) =>
              e.target.value &&
              set({ startsAt: fromLocalInput(e.target.value) })
            }
          />
        </Field>
        <Field
          label="expires"
          hint="after this, nobody sees it, even if they never logged in"
        >
          <input
            type="datetime-local"
            className={inputClass}
            value={toLocalInput(draft.expiresAt)}
            onChange={(e) =>
              e.target.value &&
              set({ expiresAt: fromLocalInput(e.target.value) })
            }
          />
        </Field>
        <Field label="order" hint="lower shows first">
          <input
            type="number"
            className={inputClass}
            value={draft.position}
            onChange={(e) => set({ position: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>

      <ErrorText error={save.error} />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disableLoad onClick={() => submit()}>
          save
        </Button>
        {!draft.active && (
          <Button
            size="sm"
            variant="base"
            disableLoad
            onClick={() => submit(true)}
          >
            save & activate
          </Button>
        )}
        <Button size="sm" variant="base" disableLoad onClick={preview}>
          preview
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-pencil underline cursor-pointer"
        >
          cancel
        </button>
        <span className="ml-auto text-sm text-pencil">
          {draft.active ? 'active' : 'draft: only you can preview it'}
        </span>
      </div>
    </Panel>
  );
};

const Row: FC<{
  announcement: AdminAnnouncement;
  onEdit: () => void;
}> = ({ announcement: a, onEdit }) => {
  const save = useSaveAnnouncement();
  const remove = useDeleteAnnouncement();
  const reset = useResetAnnouncementViews();
  const show = useShowAnnouncements();
  const status = statusOf(a);
  const error = save.error ?? remove.error ?? reset.error;

  const link = 'underline whitespace-nowrap cursor-pointer';

  return (
    <tr>
      <td className={td}>
        <div className="font-bold">{a.title}</div>
        <div className="text-sm text-pencil line-clamp-1 max-w-xs">
          {a.body}
        </div>
        {error && <div className="text-sm text-coral">{error.message}</div>}
      </td>
      <td className={td}>
        <Tag className={STATUS_COLORS[status]}>{status}</Tag>
      </td>
      <td className={cn(td, 'whitespace-nowrap')}>
        {formatDateTime(a.startsAt)} → {formatDateTime(a.expiresAt)}
      </td>
      <td className={td}>{a.position}</td>
      <td className={td}>{ART_LABELS[a.art]}</td>
      <td className={td}>{a.seenBy}</td>
      <td className={td}>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <button type="button" className={link} onClick={onEdit}>
            edit
          </button>
          <button
            type="button"
            className={link}
            onClick={() => save.mutate({ ...a, active: !a.active })}
          >
            {a.active ? 'deactivate' : 'activate'}
          </button>
          <button
            type="button"
            className={link}
            onClick={() => show([a], { preview: true })}
          >
            preview
          </button>
          {a.seenBy > 0 && (
            <button
              type="button"
              className={link}
              onClick={() => {
                if (
                  confirm(
                    `Show "${a.title}" again to the ${a.seenBy} players who've seen it?`,
                  )
                )
                  reset.mutate(a.id);
              }}
            >
              show again
            </button>
          )}
          <button
            type="button"
            className={cn(link, 'text-coral')}
            onClick={() => {
              if (confirm(`Delete "${a.title}"? This can't be undone.`))
                remove.mutate(a.id);
            }}
          >
            delete
          </button>
        </span>
      </td>
    </tr>
  );
};

const AnnouncementsPage = () => {
  const announcements = useAdminAnnouncements();
  const show = useShowAnnouncements();
  // The announcement being edited, or a new one
  const [editing, setEditing] = useState<AnnouncementDraft | null>(null);

  const list = announcements.data ?? [];
  const live = list
    .filter((a) => statusOf(a) === 'live')
    .sort((a, b) => a.position - b.position);

  return (
    <AdminPage
      title="announcements"
      subtitle="full-screen what's-new pages: each player sees the live ones once when they next open the app, and can reopen them from the bell"
      actions={
        <>
          <Button
            size="sm"
            variant="base"
            disableLoad
            disabled={live.length === 0}
            onClick={() => show(live, { preview: true })}
          >
            preview live ({live.length})
          </Button>
          <Button
            size="sm"
            disableLoad
            onClick={() =>
              setEditing(
                blankDraft(Math.max(-1, ...list.map((a) => a.position)) + 1),
              )
            }
          >
            new announcement
          </Button>
        </>
      }
    >
      {editing && (
        <Section
          title={editing.id ? `editing “${editing.title}”` : 'new announcement'}
        >
          <Editor
            key={editing.id ?? 'new'}
            initial={editing}
            onClose={() => setEditing(null)}
          />
        </Section>
      )}

      <Loaded query={announcements}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="py-10 text-center text-pencil">
              no announcements yet
            </p>
          ) : (
            <Table
              head={
                <>
                  <th className={th}>announcement</th>
                  <th className={th}>status</th>
                  <th className={th}>shows</th>
                  <th className={th}>order</th>
                  <th className={th}>art</th>
                  <th className={th}>seen by</th>
                  <th className={th} />
                </>
              }
            >
              {rows.map((a) => (
                <Row key={a.id} announcement={a} onEdit={() => setEditing(a)} />
              ))}
            </Table>
          )
        }
      </Loaded>
    </AdminPage>
  );
};

export default AnnouncementsPage;
