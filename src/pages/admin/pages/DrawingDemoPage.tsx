import { useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { faShuffle } from '@fortawesome/free-solid-svg-icons';
import { eventOnDay, useAdminEvents, useAdminPrompts } from '../api';
import { generateRandomColors } from '../utils';
import { AdminPage, Loaded, Panel, formatDay } from '../components/ui';
import type { AdminPrompt } from '../api';
import type { FC } from 'react';
import Button from '@/components/Button';
import { DrawingProvider } from '@/drawing/DrawingContext';
import EventIcon from '@/events/EventIcon';
import Snowfall from '@/events/christmas/Snowfall';
import { TreeIcon } from '@/events/christmas/Decorations';
import { PinCeremony } from '@/drawing/components/PinCeremony';
import { PIN_COLORS } from '@/components/PushPin';
import { cn } from '@/utils';
import useUser from '@/auth/hooks/useUser';
import useLocalStorage from '@/hooks/useLocalStorage';
import DrawingCanvas from '@/pages/feed/components/DrawingCanvas';
import { PromptTitle } from '@/pages/feed/components/PromptTitle';

const ColorInput: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex items-center gap-3">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-12 h-10 border-2 border-ink rounded-sketch-alt cursor-pointer"
    />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-28 px-2 py-1 font-mono bg-white border-2 border-ink rounded-sketch-alt"
    />
    <span className="text-pencil">{label}</span>
  </label>
);

const Checkbox: FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="size-5 accent-[var(--color-ink)]"
    />
    {label}
  </label>
);

/** Three colors, then the paper: the shape of a prompt's palette */
type Palette = { colors: Array<string>; paper: string };

const ColorControls: FC<{
  palette: Palette;
  onChange: (palette: Palette) => void;
}> = ({ palette, onChange }) => (
  <>
    {palette.colors.map((color, i) => (
      <ColorInput
        key={i}
        label={`color ${i + 1}`}
        value={color}
        onChange={(c) =>
          onChange({
            ...palette,
            colors: palette.colors.map((old, j) => (j === i ? c : old)),
          })
        }
      />
    ))}
    <ColorInput
      label="paper"
      value={palette.paper}
      onChange={(paper) => onChange({ ...palette, paper })}
    />
    <Button
      size="sm"
      variant="base"
      icon={faShuffle}
      disableLoad
      onClick={() => {
        const [a, b, c, paper] = generateRandomColors();
        onChange({ colors: [a, b, c], paper });
      }}
    >
      random colors
    </Button>
  </>
);

const toPalette = (colors: Array<string>): Palette => ({
  colors: colors.slice(0, 3),
  paper: colors[3] ?? '#ffffff',
});

const colorsOf = (palette: Palette) => [...palette.colors, palette.paper];

/** The draw screen as a player sees it on that day, inside a phone-sized frame */
const PromptPreview: FC<{ prompt: AdminPrompt }> = ({ prompt }) => {
  const event = eventOnDay(useAdminEvents().data ?? [], prompt.day);
  const christmas = event?.theme === 'christmas';
  const original = toPalette(prompt.colors);
  const [palette, setPalette] = useState(original);
  const changed = colorsOf(palette).join() !== colorsOf(original).join();
  const user = useUser();
  // Pinning plays the real animation; nothing is uploaded
  const [pinning, setPinning] = useState<{
    imageUrl: string;
    from: DOMRect;
  } | null>(null);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-8 overflow-x-auto pb-2 items-start">
      {/* translate-z keeps the snow's position:fixed inside the phone */}
      <div className="paper relative flex flex-col gap-4 w-[390px] shrink-0 h-[780px] px-5 py-4 overflow-hidden border-[3px] border-ink rounded-[36px] shadow-pencil [transform:translateZ(0)]">
        {christmas && <Snowfall />}
        <header
          className={cn(
            'relative flex flex-col gap-1 transition-opacity duration-300',
            pinning && 'opacity-0',
          )}
        >
          <span className="text-sm text-pencil">
            {prompt.createdBy
              ? `prompt by ${prompt.createdBy.username}`
              : 'a prompt by drawer'}
          </span>
          <PromptTitle prompt={prompt.prompt} colors={colorsOf(palette)} />
        </header>
        <DrawingProvider localStorageKey="ADMIN_PROMPT_PREVIEW">
          <DrawingCanvas
            fit
            className={cn(
              'relative flex-1 min-h-0 transition-opacity duration-300',
              pinning && 'opacity-0 pointer-events-none',
            )}
            colors={palette.colors}
            backgroundColor={palette.paper}
            downloadEnabled
            onSubmit={(png, canvas) => {
              if (!canvas) return;
              setPinning({
                imageUrl: URL.createObjectURL(png),
                from: canvas.getBoundingClientRect(),
              });
            }}
            submitLabel={
              christmas ? (
                <>
                  hang it on the tree
                  <TreeIcon />
                </>
              ) : undefined
            }
          />
        </DrawingProvider>
        {pinning && (
          <PinCeremony
            imageUrl={pinning.imageUrl}
            from={pinning.from}
            pinColor={PIN_COLORS[0]}
            user={user}
            onDone={() => {
              URL.revokeObjectURL(pinning.imageUrl);
              setPinning(null);
            }}
          />
        )}
      </div>

      <Panel className="flex flex-col gap-4 p-5 max-w-sm">
        <div className="flex items-center gap-2">
          <h2 className="font-accent font-bold text-2xl leading-none">
            {formatDay(prompt.day)}
          </h2>
          {event && <EventIcon theme={event.theme} name={event.name} />}
        </div>
        <p className="text-pencil">
          {prompt.submissions} people drew this. Tweak the colors here to try
          them out; nothing is saved
          {changed && ' — copy the hex codes into the prompt to keep them'}.
        </p>
        <ColorControls palette={palette} onChange={setPalette} />
        <Button
          size="sm"
          variant="base"
          disableLoad
          disabled={!changed}
          onClick={() => setPalette(toPalette(prompt.colors))}
        >
          back to the prompt's colors
        </Button>
      </Panel>
    </div>
  );
};

/** Pick any scheduled prompt to preview */
const PromptPicker: FC<{ prompts: Array<AdminPrompt>; day?: string }> = ({
  prompts,
  day,
}) => {
  const navigate = useNavigate();
  return (
    <select
      value={day ?? ''}
      onChange={(e) =>
        navigate({
          to: '/draw/admin/drawing',
          search: e.target.value ? { day: e.target.value } : {},
        })
      }
      className="px-3 py-2 bg-white border-2 border-ink rounded-sketch-alt"
    >
      <option value="">free play (no prompt)</option>
      {prompts.map((p) => (
        <option key={p.day} value={p.day}>
          {p.day} · {p.prompt}
        </option>
      ))}
    </select>
  );
};

/** Free play with colors you pick, before they go into a prompt */
const FreePlay = () => {
  const [colors, setColors] = useLocalStorage<Array<string>>(
    'test-colors',
    generateRandomColors(),
    10000,
  );
  const [round, setRound] = useState(false);
  const palette = toPalette(colors);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
      <Panel className="flex justify-center p-6 bg-paper">
        <div className="w-full max-w-md">
          <DrawingProvider localStorageKey="ADMIN_DRAWING">
            <DrawingCanvas
              variant={round ? 'round' : 'square'}
              colors={palette.colors}
              backgroundColor={palette.paper}
              downloadEnabled
            />
          </DrawingProvider>
        </div>
      </Panel>
      <Panel className="flex flex-col gap-4 p-5">
        <ColorControls
          palette={palette}
          onChange={(p) => setColors(colorsOf(p))}
        />
        <Checkbox
          label="round (profile pic)"
          checked={round}
          onChange={setRound}
        />
      </Panel>
    </div>
  );
};

const DrawingDemoPage = () => {
  const { day } = useSearch({ from: '/draw/admin/drawing' });
  const prompts = useAdminPrompts();

  return (
    <Loaded query={prompts}>
      {(list) => {
        const prompt = day ? list.find((p) => p.day === day) : undefined;
        return (
          <AdminPage
            title="drawing canvas"
            subtitle={
              prompt
                ? 'this prompt as players will see it'
                : 'the real canvas and toolbar; pick a prompt to preview it'
            }
            actions={<PromptPicker prompts={list} day={day} />}
          >
            {prompt ? (
              // Keyed so switching prompts resets the colors
              <PromptPreview key={prompt.day} prompt={prompt} />
            ) : day ? (
              <p className="text-coral">
                no prompt on {day}.{' '}
                <Link
                  to="/draw/admin/prompts"
                  search={{}}
                  className="underline"
                >
                  schedule one
                </Link>
              </p>
            ) : (
              <FreePlay />
            )}
          </AdminPage>
        );
      }}
    </Loaded>
  );
};

export default DrawingDemoPage;
