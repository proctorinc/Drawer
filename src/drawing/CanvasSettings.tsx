import { useRef, useState } from 'react';
import { canBuzz, previewFeedback } from './feedback';
import {
  FEEDBACK_LEVELS,
  setFeedbackLevel,
  toggleFeedback,
  useFeedbackSettings,
} from './feedbackSettings';
import type { FC } from 'react';
import type { FeedbackKind, FeedbackLevel } from './feedbackSettings';
import Sheet from '@/pages/profile/components/Sheet';
import {
  GearIcon,
  SpeakerIcon,
  SpeakerOffIcon,
  VibrateIcon,
  VibrateOffIcon,
} from '@/components/icons';
import { cn } from '@/utils';

type RowProps = {
  kind: FeedbackKind;
  label: string;
  /** A name for each level, none first */
  names: Record<FeedbackLevel, string>;
  OnIcon: FC<{ size?: number }>;
  OffIcon: FC<{ size?: number }>;
};

/** One setting: a tap to turn it on or off, and five levels to pick from */
const LevelRow: FC<RowProps> = ({ kind, label, names, OnIcon, OffIcon }) => {
  const level = useFeedbackSettings()[kind];
  const on = level > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-sound="off"
          aria-label={`${label} ${on ? 'on' : 'off'}`}
          aria-pressed={on}
          onClick={() => {
            toggleFeedback(kind);
            previewFeedback(kind);
          }}
          className={cn(
            'press flex flex-none items-center justify-center size-12 border-2 border-ink rounded-sketch-alt shadow-pencil-sm cursor-pointer transition-[rotate,background-color]',
            on ? 'bg-me -rotate-6' : 'bg-white text-pencil',
          )}
        >
          {on ? <OnIcon size={24} /> : <OffIcon size={24} />}
        </button>
        <div className="flex flex-col">
          <h3 className="font-accent font-bold text-2xl leading-none">
            {label}
          </h3>
          <span className="text-sm text-pencil">{names[level]}</span>
        </div>
      </div>
      <LevelSlider
        label={`${label} level`}
        level={level}
        names={names}
        onChange={(value) => {
          setFeedbackLevel(kind, value);
          previewFeedback(kind);
        }}
      />
    </section>
  );
};

const TOP = FEEDBACK_LEVELS.length - 1;

type SliderProps = {
  label: string;
  level: FeedbackLevel;
  names: Record<FeedbackLevel, string>;
  onChange: (level: FeedbackLevel) => void;
};

/**
 * A bar with a circle that slides along it and settles on one of the five
 * stops. Drag it, tap anywhere on the bar, or use the arrow keys.
 */
const LevelSlider: FC<SliderProps> = ({ label, level, names, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fraction = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    const next = Math.round(fraction * TOP) as FeedbackLevel;
    if (next !== level) onChange(next);
  };

  const step = (by: number) => {
    const next = Math.min(TOP, Math.max(0, level + by)) as FeedbackLevel;
    if (next !== level) onChange(next);
  };

  const at = `${(level / TOP) * 100}%`;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={TOP}
      aria-valuenow={level}
      aria-valuetext={names[level]}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        pick(event.clientX);
      }}
      onPointerMove={(event) => dragging && pick(event.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(event) => {
        const moves: Record<string, number> = {
          ArrowLeft: -1,
          ArrowDown: -1,
          ArrowRight: 1,
          ArrowUp: 1,
          Home: -TOP,
          End: TOP,
        };
        if (event.key in moves) {
          event.preventDefault();
          step(moves[event.key]);
        }
      }}
      className="group relative h-11 px-4 cursor-pointer touch-none select-none outline-none"
    >
      {/* Stops sit on this inner line, so the circle's middle lands on each */}
      <div ref={trackRef} className="relative h-full">
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 -mx-4 bg-white border-2 border-ink rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full bg-me',
              !dragging &&
                'transition-[width] duration-300 ease-[var(--ease-spring)]',
            )}
            // The bar runs 1rem past the stops at each end
            style={{ width: `calc(1rem + (100% - 2rem) * ${level / TOP})` }}
          />
        </div>
        {FEEDBACK_LEVELS.map((value) => (
          <span
            key={value}
            aria-hidden="true"
            className={cn(
              'absolute top-1/2 size-1.5 -translate-1/2 rounded-full',
              value <= level ? 'bg-ink' : 'bg-line',
            )}
            style={{ left: `${(value / TOP) * 100}%` }}
          />
        ))}
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1/2 size-8 -translate-1/2 bg-white border-2 border-ink rounded-full transition-[left,scale] group-focus-visible:ring-2 group-focus-visible:ring-ink group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-paper',
            dragging
              ? 'scale-110 duration-150 ease-out'
              : 'duration-300 ease-[var(--ease-spring)]',
            level === 0 && 'bg-paper',
          )}
          style={{ left: at }}
        />
      </div>
    </div>
  );
};

const SOUND_NAMES: Record<FeedbackLevel, string> = {
  0: 'off',
  1: 'whisper',
  2: 'soft',
  3: 'normal',
  4: 'loud',
};

const VIBRATE_NAMES: Record<FeedbackLevel, string> = {
  0: 'off',
  1: 'faint',
  2: 'light',
  3: 'normal',
  4: 'strong',
};

/** A small gear that opens how the canvas sounds and buzzes */
export const CanvasSettingsButton: FC<{ className?: string }> = ({
  className,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Canvas settings"
        title="Sound and vibration"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center justify-center size-8 text-pencil rounded-full cursor-pointer hover:text-ink hover:rotate-45 transition-[rotate,color] duration-300 active:scale-90',
          className,
        )}
      >
        <GearIcon size={20} />
      </button>
      <Sheet title="settings" open={open} onClose={() => setOpen(false)}>
        <LevelRow
          kind="sound"
          label="sound"
          names={SOUND_NAMES}
          OnIcon={SpeakerIcon}
          OffIcon={SpeakerOffIcon}
        />
        {canBuzz && (
          <LevelRow
            kind="vibrate"
            label="vibrate"
            names={VIBRATE_NAMES}
            OnIcon={VibrateIcon}
            OffIcon={VibrateOffIcon}
          />
        )}
      </Sheet>
    </>
  );
};
