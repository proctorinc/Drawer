import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStopwatch } from '@fortawesome/free-solid-svg-icons';
import {
  DRAW_SECONDS,
  clockOffset,
  useStartDrawing,
  useSubmitDrawing,
} from '../api';
import { HostSays } from './HostSays';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import type { Duel, DuelRound } from '../api';
import Button from '@/components/Button';
import { DrawingProvider, useDrawing } from '@/drawing/DrawingContext';
import DrawingCanvas from '@/pages/feed/components/DrawingCanvas';
import { cn } from '@/utils';

/** Duels use the same plain set every time, so nobody's stuck without a usable color */
export const DUEL_COLORS = ['#2b2a33', '#ff6b57', '#3d7be0'];
const PAPER = '#ffffff';

/** Seconds left until `deadline` by the server's clock; null without one */
export const useSecondsLeft = (deadline: string | null, offsetMs: number) => {
  const left = () =>
    deadline === null
      ? null
      : Math.max(
          0,
          (new Date(deadline).getTime() - (Date.now() + offsetMs)) / 1000,
        );
  const [seconds, setSeconds] = useState(left);
  useEffect(() => {
    setSeconds(left());
    if (deadline === null) return;
    const timer = setInterval(() => setSeconds(left()), 200);
    return () => clearInterval(timer);
  }, [deadline, offsetMs]);
  return seconds;
};

/** The minute ticking down, as a draining bar and a number that hurries in the last ten */
export const DrawClock: FC<{ seconds: number; className?: string }> = ({
  seconds,
  className,
}) => {
  const hurry = seconds <= 10 && seconds > 0;
  return (
    <div className={cn('flex items-center gap-3 w-full', className)}>
      <span
        className={cn(
          'flex items-center gap-1.5 w-16 font-accent font-bold text-3xl tabular-nums leading-none',
          hurry && 'duel-hurry text-coral',
        )}
      >
        <FontAwesomeIcon icon={faStopwatch} className="text-xl" />
        {Math.ceil(seconds)}
      </span>
      <div className="flex-1 h-4 bg-white border-2 border-ink rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-[width] duration-200 ease-linear',
            hurry ? 'bg-coral' : 'bg-butter',
          )}
          style={{ width: `${(seconds / DRAW_SECONDS) * 100}%` }}
        />
      </div>
    </div>
  );
};

const blobToDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const storageKey = (duel: Duel, round: DuelRound) =>
  `DUEL_${duel.id}_${round.number}`;

/** The canvas, the prompt and the clock, once the minute has started */
const DrawingStage: FC<{ duel: Duel; round: DuelRound; them: User }> = ({
  duel,
  round,
  them,
}) => {
  const submit = useSubmitDrawing(duel.id);
  const { getPng } = useDrawing();
  const seconds = useSecondsLeft(round.drawDeadline, clockOffset(duel)) ?? 0;
  const sent = useRef(false);

  const send = async (png: Blob) => {
    if (sent.current) return;
    sent.current = true;
    try {
      await submit.mutateAsync(await blobToDataURL(png));
      try {
        localStorage.removeItem(storageKey(duel, round));
      } catch {
        // Blocked storage: the old strokes just linger
      }
    } catch {
      sent.current = false;
    }
  };

  // Time's up: send whatever's on the canvas, even if they'd left and came back later
  useEffect(() => {
    if (seconds > 0 || sent.current || submit.isError) return;
    // A beat, so the last stroke lands
    const timer = setTimeout(() => getPng(PAPER).then(send), 150);
    return () => clearTimeout(timer);
  }, [seconds <= 0, submit.isError]);

  const timeUp = seconds <= 0;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex flex-col items-center gap-2 w-full px-4 py-3 bg-white border-2 border-ink rounded-sketch -rotate-1">
        <span className="text-sm text-pencil">your secret prompt</span>
        <h2 className="font-accent font-bold text-3xl leading-tight text-center">
          {round.prompt}
        </h2>
        <div className="flex flex-wrap justify-center gap-1.5">
          <span className="text-sm text-pencil">make these clear:</span>
          {round.keywords.map((keyword) => (
            <span
              key={keyword}
              className="px-2 py-0.5 text-sm leading-tight bg-butter border-[1.5px] border-ink rounded-full"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <DrawClock seconds={seconds} />

      <div className={cn('relative w-full', timeUp && 'pointer-events-none')}>
        <DrawingCanvas
          colors={DUEL_COLORS}
          backgroundColor={PAPER}
          onSubmit={(png) => send(png)}
          submitLabel={
            submit.isPending ? 'sending…' : `done, send it to ${them.username}`
          }
        />
        {timeUp && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="px-4 py-2 font-accent font-bold text-3xl bg-white border-[3px] border-ink rounded-sketch -rotate-3 animate-pop">
              {submit.isPending || !submit.isError
                ? "time's up! sending…"
                : "time's up"}
            </span>
          </div>
        )}
      </div>
      {submit.isError && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-coral">{submit.error.message}</p>
          <Button
            size="sm"
            onClick={() => getPng(PAPER).then(send)}
            disabled={submit.isPending}
          >
            try sending again
          </Button>
        </div>
      )}
    </div>
  );
};

type Props = {
  duel: Duel;
  round: DuelRound;
  them: User;
  /** What the host says first, e.g. how the last round went */
  lead?: string;
};

/**
 * Your turn to draw. The prompt stays hidden until you're ready, because
 * showing it starts your minute; after that it's the canvas and the clock.
 */
export const DrawTurn: FC<Props> = ({ duel, round, them, lead }) => {
  const start = useStartDrawing(duel.id);

  if (!round.drawStartedAt) {
    const line = [lead, `Your turn to draw. You get ${DRAW_SECONDS} seconds.`]
      .filter(Boolean)
      .join(' ');
    return (
      <HostSays host={duel.host} line={line}>
        <Button
          className="w-full"
          onClick={() => start.mutate()}
          disabled={start.isPending}
          disableLoad
        >
          {start.isPending ? '…' : 'show prompt'}
        </Button>
        <p className="mt-2 text-sm text-center text-pencil">
          clock starts right away
        </p>
        {start.isError && (
          <p className="mt-1 text-sm text-center text-coral">
            {start.error.message}
          </p>
        )}
      </HostSays>
    );
  }

  return (
    <DrawingProvider localStorageKey={storageKey(duel, round)}>
      <DrawingStage duel={duel} round={round} them={them} />
    </DrawingProvider>
  );
};
