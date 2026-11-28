import { useState } from 'react';
import { useAdminPrompts } from '../api';
import { useAdminStickers, useSetPromptSticker } from '../stickerApi';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Table,
  formatDay,
  td,
  th,
} from '../components/ui';
import type { AdminPrompt } from '../api';
import type { DaySticker } from '../stickerApi';
import type { FC } from 'react';
import type { PromptSticker, StickerKind } from '@/stickers/stickers';
import Button from '@/components/Button';
import { DrawingProvider, useDrawing } from '@/drawing/DrawingContext';
import { Toolbar } from '@/drawing/Toolbar';
import ZoomableCanvas from '@/drawing/ZoomableCanvas';
import { defaultPencils } from '@/drawing/pencils';
import { StickerProvider, useStickers } from '@/stickers/StickerContext';
import { StickerLayer } from '@/stickers/StickerLayer';
import { AddStickerButton, StickerControls } from '@/stickers/StickerControls';
import {
  BUBBLE_CHARS,
  MAX_STICKER_SIZE,
  MIN_STICKER_SIZE,
  PLAYER_SCALE,
  STICKERS,
  STICKER_KINDS,
  defaultSticker,
} from '@/stickers/stickers';
import { cn } from '@/utils';

const PLAYGROUND_COLORS = ['#2b2a33', '#ff6b57', '#4f9dde'];
const PLAYGROUND_PAPER = '#fbf8f1';

const SizeInput: FC<{
  value: number;
  onChange: (size: number) => void;
  className?: string;
}> = ({ value, onChange, className }) => (
  <label className={cn('flex items-center gap-1', className)}>
    <input
      type="number"
      min={MIN_STICKER_SIZE}
      max={MAX_STICKER_SIZE}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 px-2 py-1 bg-white border-2 border-ink rounded-sketch-alt"
    />
    <span className="text-pencil">% wide</span>
  </label>
);

const sizeIsValid = (size: number) =>
  Number.isInteger(size) &&
  size >= MIN_STICKER_SIZE &&
  size <= MAX_STICKER_SIZE;

/** How many letters a word bubble holds */
const LettersInput: FC<{
  value: number;
  onChange: (maxChars: number) => void;
}> = ({ value, onChange }) => (
  <label className="flex items-center gap-1">
    <input
      type="number"
      min={BUBBLE_CHARS.min}
      max={BUBBLE_CHARS.max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 px-2 py-1 bg-white border-2 border-ink rounded-sketch-alt"
    />
    <span className="text-pencil">letters</span>
  </label>
);

const lettersAreValid = (maxChars: number) =>
  Number.isInteger(maxChars) &&
  maxChars >= BUBBLE_CHARS.min &&
  maxChars <= BUBBLE_CHARS.max;

/** Whether a sticker is one admins can save: a size in range, and letters for a bubble */
const stickerIsValid = ({ kind, size, maxChars }: PromptSticker) =>
  sizeIsValid(size) && (kind !== 'bubble' || lettersAreValid(maxChars ?? 0));

/** The canvas with the sticker on it, and what the pinned picture comes out as */
const Playground: FC = () => {
  const { getPng, hasInk } = useDrawing();
  const { selected, paintOver, placed } = useStickers();
  const [pinned, setPinned] = useState<string | null>(null);

  async function pin() {
    const png = await getPng(PLAYGROUND_PAPER, paintOver);
    if (pinned) URL.revokeObjectURL(pinned);
    setPinned(URL.createObjectURL(png));
  }

  return (
    <div className="flex flex-wrap gap-8 items-start">
      <div className="flex flex-col gap-3 w-[min(100%,370px)]">
        <ZoomableCanvas
          backgroundColor={PLAYGROUND_PAPER}
          overlay={<StickerLayer />}
        />
        <Toolbar
          pencils={defaultPencils(PLAYGROUND_COLORS)}
          extra={<AddStickerButton />}
          className={cn(selected && 'hidden')}
        />
        {selected && <StickerControls />}
        <Button
          size="sm"
          disableLoad
          disabled={!hasInk && !placed}
          onClick={pin}
        >
          see what gets pinned
        </Button>
      </div>
      {pinned && (
        <figure className="flex flex-col gap-2 w-[min(100%,280px)]">
          <img
            src={pinned}
            alt="The pinned drawing, sticker and all"
            className="w-full border-2 border-ink rounded-sketch-alt shadow-pencil-sm"
          />
          <figcaption className="text-sm text-pencil">
            the picture that goes up on the wall: the sticker is part of it now
          </figcaption>
        </figure>
      )}
    </div>
  );
};

/** Any sticker at any size, on a scratch canvas; nothing is saved */
const TryItOut: FC<{
  sticker: PromptSticker;
  onChange: (sticker: PromptSticker) => void;
}> = ({ sticker, onChange }) => {
  const [size, setSize] = useState(sticker.size);
  const [maxChars, setMaxChars] = useState(
    sticker.maxChars ?? BUBBLE_CHARS.default,
  );
  const tried = sizeIsValid(size) ? { ...sticker, size } : sticker;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8 items-start">
      <Panel className="p-6 bg-paper">
        <DrawingProvider localStorageKey="ADMIN_STICKERS">
          {/* Keyed so a new kind starts off the page */}
          <StickerProvider key={tried.kind} sticker={tried}>
            <Playground />
          </StickerProvider>
        </DrawingProvider>
      </Panel>
      <Panel className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2">
          {STICKER_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant={kind === sticker.kind ? 'primary' : 'base'}
              disableLoad
              onClick={() => {
                setSize(STICKERS[kind].defaultSize);
                setMaxChars(BUBBLE_CHARS.default);
                onChange(defaultSticker(kind));
              }}
            >
              {STICKERS[kind].label}
            </Button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-pencil">starting size</span>
          <input
            type="range"
            min={MIN_STICKER_SIZE}
            max={MAX_STICKER_SIZE}
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              onChange({ ...sticker, size: Number(e.target.value) });
            }}
            className="accent-[var(--color-ink)]"
          />
        </label>
        <SizeInput
          value={size}
          onChange={(next) => {
            setSize(next);
            if (sizeIsValid(next)) onChange({ ...sticker, size: next });
          }}
        />
        {sticker.kind === 'bubble' && (
          <LettersInput
            value={maxChars}
            onChange={(next) => {
              setMaxChars(next);
              if (lettersAreValid(next))
                onChange({ ...sticker, maxChars: next });
            }}
          />
        )}
        <p className="text-sm text-pencil">
          Players can shrink it to {PLAYER_SCALE.min * 100}% of this or grow it
          to {PLAYER_SCALE.max * 100}% by its corner, and drag it anywhere on
          the page. It goes into the picture when they pin it.
        </p>
      </Panel>
    </div>
  );
};

/** One prompt's sticker: pick one, size it, save it */
const PromptStickerRow: FC<{
  prompt: AdminPrompt;
  saved: DaySticker | undefined;
  onTry: (sticker: PromptSticker) => void;
}> = ({ prompt, saved, onTry }) => {
  const [kind, setKind] = useState<StickerKind | ''>(saved?.kind ?? '');
  const [size, setSize] = useState(saved?.size ?? 0);
  const [maxChars, setMaxChars] = useState(
    saved?.maxChars ?? BUBBLE_CHARS.default,
  );
  const setSticker = useSetPromptSticker();
  const draft: PromptSticker | null = kind
    ? { kind, size, ...(kind === 'bubble' && { maxChars }) }
    : null;
  const dirty =
    (saved?.kind ?? '') !== kind ||
    (!!draft &&
      (saved?.size !== draft.size || saved.maxChars !== draft.maxChars));
  const valid = !draft || stickerIsValid(draft);

  return (
    <tr>
      <td className={cn(td, 'whitespace-nowrap')}>{formatDay(prompt.day)}</td>
      <td className={td}>{prompt.prompt}</td>
      <td className={td}>
        <select
          value={kind}
          onChange={(e) => {
            const next = e.target.value as StickerKind | '';
            setKind(next);
            if (next) {
              setSize(STICKERS[next].defaultSize);
              setMaxChars(BUBBLE_CHARS.default);
            }
          }}
          className="px-2 py-1 bg-white border-2 border-ink rounded-sketch-alt"
        >
          <option value="">none</option>
          {STICKER_KINDS.map((k) => (
            <option key={k} value={k}>
              {STICKERS[k].label}
            </option>
          ))}
        </select>
      </td>
      <td className={td}>
        {kind && <SizeInput value={size} onChange={setSize} />}
      </td>
      <td className={td}>
        {kind === 'bubble' && (
          <LettersInput value={maxChars} onChange={setMaxChars} />
        )}
      </td>
      <td className={cn(td, 'whitespace-nowrap')}>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="base"
            disabled={!draft || !valid}
            disableLoad
            onClick={() => draft && onTry(draft)}
          >
            try
          </Button>
          <Button
            size="sm"
            disabled={!dirty || !valid}
            onClick={() =>
              setSticker.mutateAsync({ day: prompt.day, sticker: draft })
            }
          >
            save
          </Button>
        </div>
        {setSticker.error && (
          <p className="mt-1 text-sm text-coral">{setSticker.error.message}</p>
        )}
      </td>
    </tr>
  );
};

/** Today's prompt onwards, and any earlier one that had a sticker */
function promptsToShow(
  prompts: Array<AdminPrompt>,
  stickers: Array<DaySticker>,
) {
  // From yesterday (UTC), so today's prompt shows wherever the server's clock is
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const stuck = new Set(stickers.map((s) => s.day));
  return prompts
    .filter((p) => p.day >= from || stuck.has(p.day))
    .sort((a, b) => a.day.localeCompare(b.day));
}

const PromptStickersPage = () => {
  const prompts = useAdminPrompts();
  const stickers = useAdminStickers();
  const [trying, setTrying] = useState(defaultSticker('bubble'));
  // Bumped when a prompt's sticker is tried, so the size controls pick it up
  const [tries, setTries] = useState(0);

  return (
    <AdminPage
      title="stickers"
      subtitle="something fun players can stick on their drawing before they pin it, one per prompt"
    >
      <Section title="try them out">
        <TryItOut key={tries} sticker={trying} onChange={setTrying} />
      </Section>
      <Section
        title="on prompts"
        aside="a prompt with no sticker shows no sticker button"
      >
        <Loaded query={prompts}>
          {(promptList) => (
            <Loaded query={stickers}>
              {(stickerList) => (
                <Table
                  head={
                    <>
                      <th className={th}>day</th>
                      <th className={th}>prompt</th>
                      <th className={th}>sticker</th>
                      <th className={th}>size</th>
                      <th className={th}>letters</th>
                      <th className={th} />
                    </>
                  }
                >
                  {promptsToShow(promptList, stickerList).map((prompt) => {
                    const saved = stickerList.find((s) => s.day === prompt.day);
                    return (
                      <PromptStickerRow
                        // Keyed by what's saved, so a save resets the row
                        key={`${prompt.day}-${saved?.kind}-${saved?.size}-${saved?.maxChars}`}
                        prompt={prompt}
                        saved={saved}
                        onTry={(sticker) => {
                          setTrying(sticker);
                          setTries((n) => n + 1);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    );
                  })}
                </Table>
              )}
            </Loaded>
          )}
        </Loaded>
      </Section>
    </AdminPage>
  );
};

export default PromptStickersPage;
