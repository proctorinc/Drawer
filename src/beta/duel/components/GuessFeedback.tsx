import { useEffect, useState } from 'react';
import { hitKeywords } from '../api';
import type { FC } from 'react';
import type { DuelGuess, DuelRound, KeywordMark, MarkStatus } from '../api';
import { cn } from '@/utils';
import { CleanText } from '@/moderation/CleanText';

/** Green for "means the same", yellow for "close", plain for a miss: like Wordle */
export const tileClass: Record<MarkStatus, string> = {
  hit: 'bg-[#b9e6a4] border-ink',
  close: 'bg-butter border-ink',
  miss: 'bg-white border-line text-pencil',
};

/** Counts up to a score, so it lands with a bit of drama */
export const useCountUp = (target: number, animate: boolean, ms = 700) => {
  const [value, setValue] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, animate, ms]);
  return value;
};

/** A percent in a round sticker, flat ink */
export const ScoreBadge: FC<{
  score: number;
  animate?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
}> = ({ score, animate = false, size = 'sm', className }) => {
  const shown = useCountUp(score, animate);
  return (
    <span
      className={cn(
        'grid place-items-center flex-none font-accent font-bold leading-none tabular-nums border-2 border-ink rounded-full rotate-6',
        score >= 80 ? 'bg-[#b9e6a4]' : score >= 40 ? 'bg-butter' : 'bg-white',
        size === 'sm' ? 'size-12 text-lg' : 'size-24 text-4xl border-[3px]',
        className,
      )}
    >
      {shown}%
    </span>
  );
};

/** One guess: its words as tiles that flip in, each with a tiny note, and its score */
export const GuessRow: FC<{ guess: DuelGuess; fresh?: boolean }> = ({
  guess,
  fresh = false,
}) => (
  <li className="flex items-start gap-3 w-full">
    <span className="mt-2 w-5 text-sm text-pencil">{guess.attempt}.</span>
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <div className="flex flex-wrap gap-1.5 [perspective:400px]">
        {guess.feedback.words.map((word, i) => (
          <span
            key={i}
            className="flex flex-col items-center max-w-[8rem]"
            style={fresh ? { animationDelay: `${i * 120}ms` } : undefined}
          >
            <span
              className={cn(
                'px-2 py-1 text-lg leading-none border-2 rounded-[6px]',
                fresh && 'duel-tile',
                tileClass[word.status],
              )}
              style={fresh ? { animationDelay: `${i * 120}ms` } : undefined}
            >
              <CleanText text={word.text} />
            </span>
            {word.note && (
              <span className="mt-0.5 text-[0.7rem] leading-tight text-center text-pencil">
                {word.note}
              </span>
            )}
          </span>
        ))}
      </div>
      {guess.exact && (
        <span className="self-start px-2 py-0.5 text-sm font-bold bg-butter border-2 border-ink rounded-full -rotate-2 animate-pop">
          word for word! bonus
        </span>
      )}
    </div>
    <ScoreBadge score={guess.score} animate={fresh} />
  </li>
);

/** One of the prompt's keywords: revealed once hit, a hint while close, blank till then */
const KeywordSlot: FC<{ mark: KeywordMark | null; reveal?: string }> = ({
  mark,
  reveal,
}) => {
  const status = mark?.status ?? 'miss';
  const text = mark?.keyword || reveal;
  return (
    <span className="flex flex-col items-center gap-0.5 min-w-14 max-w-[9rem]">
      <span
        className={cn(
          'w-full px-2 py-1 text-center text-lg leading-tight border-2 rounded-[6px]',
          mark ? tileClass[status] : 'bg-white border-dashed border-line',
          !mark?.keyword && reveal && 'text-pencil',
        )}
      >
        {text || '?'}
      </span>
      {mark?.note && status !== 'hit' && (
        <span className="text-[0.7rem] leading-tight text-center text-pencil">
          {mark.note}
        </span>
      )}
    </span>
  );
};

/**
 * The prompt's keywords as slots, filled in as guesses hit them. Each slot shows
 * the best any guess has done on it. With `reveal`, the missed ones show too.
 */
export const KeywordSlots: FC<{ round: DuelRound; reveal?: boolean }> = ({
  round,
  reveal = false,
}) => {
  const slots = hitKeywords(round);
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {slots.map((mark, i) => (
        <KeywordSlot
          key={i}
          mark={mark}
          reveal={reveal ? round.keywords[i] : undefined}
        />
      ))}
    </div>
  );
};

/** The key: what the colors mean */
export const TileLegend = () => (
  <div className="flex flex-wrap justify-center gap-3 text-sm text-pencil">
    <span className="flex items-center gap-1">
      <span className={cn('size-3.5 border-2 rounded-[3px]', tileClass.hit)} />
      got it
    </span>
    <span className="flex items-center gap-1">
      <span
        className={cn('size-3.5 border-2 rounded-[3px]', tileClass.close)}
      />
      close
    </span>
    <span className="flex items-center gap-1">
      <span className={cn('size-3.5 border-2 rounded-[3px]', tileClass.miss)} />
      not in it
    </span>
  </div>
);
