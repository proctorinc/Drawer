import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  faFlask,
  faFloppyDisk,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import {
  useAIPersonalities,
  useAISettings,
  useAdminSubmissions,
  useSaveAIPersonality,
  useTestAI,
} from '../api';
import { AdminPage, Loaded, Panel, Section, Tag } from '../components/ui';
import {
  CriteriaEditor,
  ErrorText,
  Field,
  VerdictPreview,
  inputClass,
} from '../components/aiJudgeForm';
import { AIRunBreakdown } from '../components/AIRunBreakdown';
import { ApplyAIRunButton } from '../components/ApplyAIRunButton';
import type { AIPersonality, AITestResult, AITestSource } from '../api';
import type { FC } from 'react';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import Button from '@/components/Button';
import { DrawingProvider } from '@/drawing/DrawingContext';
import DrawingCanvas from '@/pages/feed/components/DrawingCanvas';
import { cn } from '@/utils';

const MAX_JUDGES = 6;

/** The custom canvas's palette: ink, two colors, and the paper */
const PALETTE = ['#2b2a33', '#ff6b57', '#3a7bd5', '#ffb400'];
const PAPER = '#fbf8f1';

/** The model sees doodles at low detail (512px), so no need to send more */
const MAX_IMAGE_SIDE = 512;

async function shrinkToDataURL(png: Blob): Promise<string> {
  const bitmap = await createImageBitmap(png);
  const scale = Math.min(
    1,
    MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Whether a draft differs from the saved judge in anything the model reads */
const isEdited = (draft: AIPersonality, saved: AIPersonality) =>
  draft.systemPrompt !== saved.systemPrompt ||
  JSON.stringify(draft.criteria) !== JSON.stringify(saved.criteria);

/** One click of "run": the doodle, and every judge's answer */
type Batch = {
  id: string;
  prompt: string;
  imageUrl: string;
  /** The past doodle it judged, which a run can be applied to; null for a custom drawing */
  submissionId: string | null;
  at: Date;
  results: Array<AITestResult & { judge: AIPersonality; edited: boolean }>;
};

// --- The doodle ---

type Source =
  | { kind: 'past'; submissionId: string }
  | { kind: 'own'; prompt: string; imageData: string };

const PastDoodlePicker: FC<{
  submissionId: string;
  onChange: (submissionId: string) => void;
}> = ({ submissionId, onChange }) => {
  const submissions = useAdminSubmissions();
  return (
    <Loaded query={submissions}>
      {(list) => {
        const recent = list.slice(0, 80);
        const picked = recent.find((s) => s.id === submissionId);
        return (
          <div className="flex flex-col gap-3">
            <select
              className={inputClass}
              value={submissionId}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">pick a doodle…</option>
              {recent.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prompt} · {s.user.username} · {s.day}
                </option>
              ))}
            </select>
            {picked && (
              <figure className="flex flex-col gap-2 items-center">
                {picked.imageUrl && (
                  <img
                    src={picked.imageUrl}
                    alt={picked.prompt}
                    className="w-full max-w-sm aspect-square object-contain border-2 border-ink rounded-sketch-alt bg-white"
                  />
                )}
                <figcaption className="font-accent font-bold text-2xl text-center">
                  “{picked.prompt}”
                </figcaption>
              </figure>
            )}
          </div>
        );
      }}
    </Loaded>
  );
};

const OwnDoodle: FC<{
  prompt: string;
  imageData: string;
  onChange: (patch: { prompt?: string; imageData?: string }) => void;
}> = ({ prompt, imageData, onChange }) => (
  <div className="flex flex-col gap-4">
    <Field label="prompt" hint="what the judges think you were asked to draw">
      <input
        className={inputClass}
        placeholder="a cat riding a skateboard"
        value={prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
      />
    </Field>
    <DrawingProvider localStorageKey="ADMIN_AI_TESTING_GROUND">
      <DrawingCanvas
        className="self-center"
        colors={PALETTE}
        backgroundColor={PAPER}
        submitLabel={imageData ? 'use this version' : 'use this drawing'}
        onSubmit={async (png) =>
          onChange({ imageData: await shrinkToDataURL(png) })
        }
      />
    </DrawingProvider>
    {imageData ? (
      <div className="flex items-center gap-3 text-pencil">
        <img
          src={imageData}
          alt="the drawing the judges will see"
          className="size-16 border-2 border-ink rounded-sketch-alt bg-white"
        />
        the judges will see this. Keep drawing and press the button again to
        update it.
      </div>
    ) : (
      <p className="text-pencil">
        Draw, then press the button to hand it to the judges.
      </p>
    )}
  </div>
);

// --- The judges ---

const JudgePicker: FC<{
  saved: AIPersonality;
  draft: AIPersonality | undefined;
  disabled: boolean;
  onToggle: () => void;
  onChange: (draft: AIPersonality) => void;
}> = ({ saved, draft, disabled, onToggle, onChange }) => {
  const save = useSaveAIPersonality();
  const [open, setOpen] = useState(false);
  const selected = !!draft;
  const edited = !!draft && isEdited(draft, saved);

  return (
    <Panel
      className={cn(
        'flex flex-col gap-3 p-3',
        !selected && 'border-dashed shadow-none',
      )}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-[var(--color-ink)]"
          checked={selected}
          disabled={disabled && !selected}
          onChange={onToggle}
          aria-label={`run ${saved.name}`}
        />
        <AIJudgeAvatar judge={saved} />
        <span className="flex-1 min-w-0">
          <b className="font-accent text-xl">{saved.name}</b>{' '}
          <span className="text-sm text-pencil">
            {saved.criteria.length > 0
              ? saved.criteria.map((c) => c.name).join(' · ')
              : 'one overall score'}
          </span>
        </span>
        {!saved.enabled && <Tag>off</Tag>}
        {saved.isDefault && <Tag className="bg-sky">default</Tag>}
        {edited && <Tag className="bg-butter">edited</Tag>}
        {selected && (
          <button
            type="button"
            className="text-sm underline text-pencil hover:text-ink cursor-pointer"
            onClick={() => setOpen(!open)}
          >
            {open ? 'hide' : 'tweak'}
          </button>
        )}
      </div>
      {selected && open && (
        <div className="flex flex-col gap-4 pt-2 border-t-2 border-dashed border-line">
          <Field
            label="personality"
            hint="changes here only affect test runs until you save them"
          >
            <textarea
              className={cn(inputClass, 'min-h-40 font-mono text-sm')}
              value={draft.systemPrompt}
              onChange={(e) =>
                onChange({ ...draft, systemPrompt: e.target.value })
              }
            />
          </Field>
          <CriteriaEditor
            criteria={draft.criteria}
            onChange={(criteria) => onChange({ ...draft, criteria })}
          />
          <ErrorText error={save.error} />
          <div className="flex gap-2">
            <Button
              size="sm"
              icon={faFloppyDisk}
              disableLoad
              disabled={!edited || save.isPending}
              onClick={() =>
                save.mutate(draft, { onSuccess: (fresh) => onChange(fresh) })
              }
            >
              save to {saved.name}
            </Button>
            <Button
              size="sm"
              variant="base"
              icon={faRotateLeft}
              disableLoad
              disabled={!edited}
              onClick={() => onChange(saved)}
            >
              reset
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
};

// --- Results ---

const BatchResults: FC<{ batch: Batch }> = ({ batch }) => (
  <Panel className="flex flex-col gap-4 p-4">
    <div className="flex items-center gap-4">
      {batch.imageUrl && (
        <img
          src={batch.imageUrl}
          alt={batch.prompt}
          className="size-20 object-contain border-2 border-ink rounded-sketch-alt bg-white"
        />
      )}
      <div>
        <div className="font-accent font-bold text-2xl">“{batch.prompt}”</div>
        <div className="text-sm text-pencil">
          {batch.at.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
          })}{' '}
          · {batch.results.length}{' '}
          {batch.results.length === 1 ? 'judge' : 'judges'}
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {batch.results.map((r) => (
        <div
          key={r.judge.id || r.name}
          className="flex flex-col gap-4 p-3 border-2 border-line rounded-sketch-alt bg-paper min-w-0"
        >
          <div className="flex flex-col gap-2">
            {r.verdict ? (
              <VerdictPreview
                verdict={r.verdict}
                personality={r.judge}
                submissionId={batch.id}
              />
            ) : (
              <div className="flex items-center gap-3">
                <AIJudgeAvatar judge={r.judge} />
                <b className="font-accent text-xl">{r.judge.name}</b>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {r.edited && <Tag className="bg-butter">edited prompt</Tag>}
              {batch.submissionId && r.verdict && r.run.id && (
                <ApplyAIRunButton
                  run={{ ...r.run, submissionId: batch.submissionId }}
                  note={
                    r.edited &&
                    "this run used an edited prompt that isn't saved; the judge keeps its saved prompt for other doodles."
                  }
                  showLabel
                />
              )}
            </div>
          </div>
          <AIRunBreakdown run={r.run} hideComment />
        </div>
      ))}
    </div>
  </Panel>
);

// --- Page ---

/**
 * Run judges on a past doodle or your own drawing, tweak them, and compare.
 * Admin only: nothing here reaches players unless you apply a run to a past
 * doodle, and every run lands in the AI log.
 */
const AITestingGroundPage = () => {
  const settings = useAISettings();
  const personalities = useAIPersonalities();
  const submissions = useAdminSubmissions();
  const test = useTestAI();

  const [source, setSource] = useState<Source>({
    kind: 'past',
    submissionId: '',
  });
  const [drafts, setDrafts] = useState<Partial<Record<string, AIPersonality>>>(
    {},
  );
  const [batches, setBatches] = useState<Array<Batch>>([]);

  const saved = personalities.data ?? [];
  const selected = saved.filter((p) => drafts[p.id]);
  const canRun = !!settings.data?.hasApiKey;
  const sourceReady =
    source.kind === 'past'
      ? !!source.submissionId
      : !!source.prompt.trim() && !!source.imageData;

  const toggle = (p: AIPersonality) =>
    setDrafts((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = p;
      return next;
    });

  function run() {
    const judges = selected.map((p) => drafts[p.id] ?? p);
    const body: AITestSource =
      source.kind === 'past'
        ? { submissionId: source.submissionId }
        : { prompt: source.prompt, imageData: source.imageData };
    const imageUrl =
      source.kind === 'past'
        ? (submissions.data?.find((s) => s.id === source.submissionId)
            ?.imageUrl ?? '')
        : source.imageData;

    test.mutate(
      { ...body, personalities: judges },
      {
        onSuccess: (data) =>
          setBatches((prev) => [
            {
              id: data.batchId,
              prompt: data.prompt,
              imageUrl,
              submissionId: source.kind === 'past' ? source.submissionId : null,
              at: new Date(),
              results: data.results.map((r, i) => ({
                ...r,
                judge: judges[i],
                edited: isEdited(judges[i], selected[i]),
              })),
            },
            ...prev,
          ]),
      },
    );
  }

  return (
    <AdminPage
      title="ai testing ground"
      subtitle="run judges on any doodle, tweak them, compare. Nothing reaches players unless you apply it."
      actions={
        <Link to="/draw/admin/ai/log" className="underline text-pencil">
          see every run in the AI log
        </Link>
      }
    >
      {!canRun && settings.data && (
        <p className="text-coral">
          Add an OpenAI key on the{' '}
          <Link to="/draw/admin/ai" className="underline">
            ai judges
          </Link>{' '}
          page to run tests. Judging doesn't have to be switched on.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,26rem)_1fr] gap-8 items-start">
        <Section title="the doodle">
          <div className="flex gap-2">
            {(
              [
                ['past', 'a past doodle'],
                ['own', 'draw my own'],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className="cursor-pointer"
                onClick={() =>
                  setSource(
                    kind === 'past'
                      ? { kind, submissionId: '' }
                      : { kind, prompt: '', imageData: '' },
                  )
                }
              >
                <Tag
                  className={cn(
                    'text-base px-3',
                    source.kind === kind ? 'bg-butter' : 'bg-white',
                  )}
                >
                  {label}
                </Tag>
              </button>
            ))}
          </div>
          {source.kind === 'past' ? (
            <PastDoodlePicker
              submissionId={source.submissionId}
              onChange={(submissionId) =>
                setSource({ kind: 'past', submissionId })
              }
            />
          ) : (
            <OwnDoodle
              prompt={source.prompt}
              imageData={source.imageData}
              onChange={(patch) => setSource({ ...source, ...patch })}
            />
          )}
        </Section>

        <Section
          title="judges"
          aside={`${selected.length} of up to ${MAX_JUDGES} picked`}
        >
          <Loaded query={personalities}>
            {(list) => (
              <div className="flex flex-col gap-2">
                {list.map((p) => (
                  <JudgePicker
                    key={p.id}
                    saved={p}
                    draft={drafts[p.id]}
                    disabled={selected.length >= MAX_JUDGES}
                    onToggle={() => toggle(p)}
                    onChange={(draft) =>
                      setDrafts((prev) => ({ ...prev, [p.id]: draft }))
                    }
                  />
                ))}
              </div>
            )}
          </Loaded>
          <div className="flex items-center gap-3">
            <Button
              icon={faFlask}
              disableLoad
              disabled={
                !canRun || !sourceReady || !selected.length || test.isPending
              }
              onClick={run}
            >
              {test.isPending
                ? 'judging…'
                : `run ${selected.length || ''} ${selected.length === 1 ? 'judge' : 'judges'}`}
            </Button>
            {!sourceReady && (
              <span className="text-pencil">
                {source.kind === 'past'
                  ? 'pick a doodle first'
                  : 'give it a prompt and use a drawing first'}
              </span>
            )}
          </div>
          <ErrorText error={test.error} />
        </Section>
      </div>

      {batches.length > 0 && (
        <Section
          title="results"
          aside={
            <button
              type="button"
              className="underline cursor-pointer"
              onClick={() => setBatches([])}
            >
              clear
            </button>
          }
        >
          {batches.map((batch) => (
            <BatchResults key={batch.id} batch={batch} />
          ))}
        </Section>
      )}
    </AdminPage>
  );
};

export default AITestingGroundPage;
