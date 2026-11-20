import { Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDesktop,
  faPlay,
  faRotateRight,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { toStageItem } from '../animationDemos';
import type { AnimationDemo, StageDemo } from '../animationDemos';
import type { ComponentType, FC, ReactNode } from 'react';
import type { StageProps } from '@/animations/types';
import Button from '@/components/Button';
import { useAnimationQueue } from '@/animations/AnimationQueue';
import { StageHostProvider } from '@/animations/StageHost';
import { TickerComponent, stageRegistry } from '@/animations/registry';
import { cn } from '@/utils';

/** A stand-in app screen, so the animation has something to play over */
const FauxScreen = () => (
  <div className="absolute inset-0 flex flex-col gap-4 px-5 pt-6 pb-4 select-none pointer-events-none">
    <div className="flex items-center justify-between">
      <span className="h-3 w-24 rounded-full bg-line" />
      <span className="flex gap-2">
        <span className="size-8 rounded-full border-2 border-line" />
        <span className="size-8 rounded-full border-2 border-line" />
      </span>
    </div>
    <span className="font-accent font-bold text-3xl leading-tight text-pencil/60">
      draw a<br />
      prehistoric city
    </span>
    <div className="grid grid-cols-2 gap-4 mt-2">
      {[-2, 3, 1, -3].map((tilt, i) => (
        <span
          key={i}
          className="aspect-[4/5] bg-white border-2 border-line p-2 pb-6"
          style={{ rotate: `${tilt}deg` }}
        >
          <span className="block size-full bg-paper" />
        </span>
      ))}
    </div>
  </div>
);

const PHONE = { width: 390, height: 780 };
// Below this width the controls go under the phone instead of beside it
const STACK_BELOW = 768;

/** Shrinks the phone to fit the window's height, never grows it */
function useFitScale() {
  const fit = () => {
    const stacked = window.innerWidth < STACK_BELOW;
    // Stacked, the controls sit under the phone and need their room too
    const height = window.innerHeight - (stacked ? 260 : 48);
    const width = window.innerWidth - (stacked ? 32 : 48 + 256 + 32);
    return Math.max(
      0.3,
      Math.min(1, height / PHONE.height, width / PHONE.width),
    );
  };
  const [scale, setScale] = useState(fit);
  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}

/** Plays a set one after another, each told where it sits ("2 of 5") */
const SetPlayer: FC<{ items: Array<StageDemo>; onDone: () => void }> = ({
  items,
  onDone,
}) => {
  const [at, setAt] = useState(0);
  const demo = items[at] as StageDemo | undefined;
  if (!demo) return null;
  const Stage = stageRegistry[demo.kind] as ComponentType<
    StageProps<typeof demo.kind>
  >;
  return (
    <Stage
      key={at}
      payload={demo.payload}
      step={{ index: at + 1, total: items.length }}
      onDone={() => {
        if (at + 1 < items.length) setAt(at + 1);
        else onDone();
      }}
    />
  );
};

/** Plays one demo inside a phone-sized frame */
const PhonePlayer: FC<{
  demo: AnimationDemo;
  run: number;
  onDone: () => void;
}> = ({ demo, run, onDone }) => {
  // The frame is the stage: fixed children and cq units resolve against it
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);

  let player: ReactNode = null;
  if (frame) {
    if (demo.lane === 'ticker') {
      player = <TickerComponent key={run} item={demo.item} onDone={onDone} />;
    } else if (demo.lane === 'set') {
      player = <SetPlayer key={run} items={demo.items} onDone={onDone} />;
    } else {
      const Stage = stageRegistry[demo.kind] as ComponentType<
        StageProps<typeof demo.kind>
      >;
      player = <Stage key={run} payload={demo.payload} onDone={onDone} />;
    }
  }

  const scale = useFitScale();

  // Scaled to fit short windows; it still lays out at true phone size inside
  return (
    <div
      className="shrink-0"
      style={{ width: PHONE.width * scale, height: PHONE.height * scale }}
    >
      <div
        ref={setFrame}
        className="paper relative overflow-hidden border-[3px] border-ink rounded-[36px] shadow-pencil origin-top-left [container-type:size]"
        style={{
          width: PHONE.width,
          height: PHONE.height,
          // Any transform makes the phone the containing block for fixed children
          transform: `scale(${scale}) translateZ(0)`,
        }}
      >
        <FauxScreen />
        {frame && (
          <StageHostProvider value={frame}>
            <Suspense fallback={null}>{player}</Suspense>
          </StageHostProvider>
        )}
      </div>
    </div>
  );
};

/**
 * A "show animation" button. Opens a phone preview that plays the demo the way
 * it looks on mobile, with replay and a full-screen option for this monitor.
 */
export const ShowAnimationButton: FC<{
  demo: AnimationDemo | null;
  title: string;
  label?: string;
  className?: string;
}> = ({ demo, title, label = 'show animation', className }) => {
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { enqueue, enqueueTicker } = useAnimationQueue();
  if (!demo) return null;

  const play = () => {
    setRun((n) => n + 1);
    setPlaying(true);
  };

  const fullScreen = () => {
    setOpen(false);
    if (demo.lane === 'ticker') {
      enqueueTicker({ ...demo.item, id: `${demo.item.id}:${Date.now()}` });
    } else if (demo.lane === 'set') {
      const group = `admin-demo:${Date.now()}`;
      demo.items.forEach((item) => void enqueue(toStageItem(item, group)));
    } else {
      void enqueue(toStageItem(demo));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          play();
        }}
        className={cn(
          'press inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-bold bg-white border-2 border-ink rounded-sketch-alt hover:-rotate-1 cursor-pointer whitespace-nowrap',
          className,
        )}
      >
        <FontAwesomeIcon icon={faPlay} className="text-xs" />
        {label}
      </button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} preview`}
            className="fixed inset-0 z-[500] flex flex-col md:flex-row items-center justify-start md:justify-center gap-4 md:gap-8 p-4 md:p-6 overflow-y-auto bg-ink/40"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <PhonePlayer
              demo={demo}
              run={run}
              onDone={() => setPlaying(false)}
            />
            <div className="flex flex-col gap-3 w-full max-w-[390px] md:w-64 shrink-0 p-4 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm">
              <span className="text-sm text-pencil">mobile preview</span>
              <h2 className="font-accent font-bold text-xl md:text-2xl leading-tight">
                {title}
              </h2>
              <p className="text-sm text-pencil">
                {playing ? 'playing…' : 'finished'}
              </p>
              <div className="grid grid-cols-3 md:grid-cols-1 gap-2 md:gap-3">
                <Button
                  size="sm"
                  className="px-1.5 md:px-4 text-[1rem] md:text-lg whitespace-nowrap"
                  variant="base"
                  disableLoad
                  onClick={play}
                >
                  <span className="hidden md:inline-flex">
                    <FontAwesomeIcon icon={faRotateRight} />
                  </span>
                  replay
                </Button>
                <Button
                  size="sm"
                  className="px-1.5 md:px-4 text-[1rem] md:text-lg whitespace-nowrap"
                  variant="base"
                  disableLoad
                  onClick={fullScreen}
                >
                  <span className="hidden md:inline-flex">
                    <FontAwesomeIcon icon={faDesktop} />
                  </span>
                  full screen
                </Button>
                <Button
                  size="sm"
                  className="px-1.5 md:px-4 text-[1rem] md:text-lg whitespace-nowrap"
                  disableLoad
                  onClick={() => setOpen(false)}
                >
                  <span className="hidden md:inline-flex">
                    <FontAwesomeIcon icon={faXmark} />
                  </span>
                  close
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
