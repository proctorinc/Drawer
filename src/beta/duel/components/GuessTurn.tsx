import { useEffect, useState } from 'react';
import { MAX_GUESSES, blankMarks, useGuess } from '../api';
import { BlankSentence, blankOrder } from './BlankSentence';
import { HostSays } from './HostSays';
import type { FC, FormEvent } from 'react';
import type { User } from '@/api/Api';
import type { Duel, DuelRound, Segment } from '../api';
import Button from '@/components/Button';
import { cn } from '@/utils';

/** A drawing in a white sketch frame, tilted a touch */
export const DuelDrawing: FC<{
  round: DuelRound;
  alt: string;
  className?: string;
}> = ({ round, alt, className }) => (
  <div
    className={cn(
      'p-2 pb-5 bg-white border-2 border-ink -rotate-1 animate-drop',
      className,
    )}
  >
    {round.image ? (
      <img
        src={round.image}
        alt={alt}
        className="block w-full aspect-square object-contain bg-white border-[1.5px] border-ink"
      />
    ) : (
      <div className="grid place-items-center w-full aspect-square text-pencil border-[1.5px] border-dashed border-line">
        loading the drawing…
      </div>
    )}
  </div>
);

/**
 * While you type, the part of the screen an on-screen keyboard leaves showing.
 * null when you're not typing, or no keyboard has come up (a hardware keyboard, a
 * desktop). It waits for the keyboard itself, not the tap, so nothing moves under
 * your finger mid-tap.
 */
const useKeyboardView = (typing: boolean) => {
  const [view, setView] = useState<{ top: number; height: number } | null>(
    null,
  );
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!typing || !viewport) return;
    const update = () =>
      setView(
        // A keyboard takes a good chunk of the screen; smaller changes are just the
        // browser's toolbars
        viewport.height < window.innerHeight * 0.8
          ? { top: viewport.offsetTop, height: viewport.height }
          : null,
      );
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [typing]);
  return typing ? view : null;
};

/** What the host says, kept short */
const hostLine = (round: DuelRound, them: User, scoring: boolean) => {
  if (scoring) return 'Checking…';
  const last = round.guesses.at(-1);
  if (!last) return `Fill in ${them.username}'s drawing. ${MAX_GUESSES} tries.`;
  const left = MAX_GUESSES - round.guesses.length;
  return `${last.score}%. ${left} ${left === 1 ? 'try' : 'tries'} left.`;
};

/**
 * Your turn to guess: their drawing, the prompt as a sentence with blanks to fill
 * in, and the hint for whichever blank you're on.
 */
export const GuessTurn: FC<{ duel: Duel; round: DuelRound; them: User }> = ({
  duel,
  round,
  them,
}) => {
  const guess = useGuess(duel.id);
  const [answers, setAnswers] = useState<Array<string>>(() =>
    Array.from({ length: round.keywordCount }, () => ''),
  );
  // The blank whose hint shows: the one you tapped, else the first still open
  const [picked, setPicked] = useState<number | null>(null);
  // Typing with an on-screen keyboard up: the guess area pins itself to what's
  // left of the screen
  const [typing, setTyping] = useState(false);
  const keyboard = useKeyboardView(typing);
  const attempt = round.guesses.length + 1;
  const marks = blankMarks(round);
  const template: Array<Segment> = round.template.length
    ? round.template
    : Array.from({ length: round.keywordCount }, (_, i) => ({
        blank: i,
        words: 1,
      }));
  const open = blankOrder(template).filter((b) => marks[b]?.status !== 'hit');
  const selected =
    picked !== null && open.includes(picked) ? picked : open.at(0);
  const ready = answers.some((a, i) => a.trim() && marks[i]?.status !== 'hit');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || guess.isPending) return;
    guess.mutate(
      answers.map((a, i) => (marks[i]?.status === 'hit' ? '' : a.trim())),
      {
        onSuccess: () =>
          setAnswers(Array.from({ length: round.keywordCount }, () => '')),
      },
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2.5 w-full',
        keyboard &&
          'paper fixed inset-x-0 z-[60] gap-2 max-w-md mx-auto px-4 py-2',
      )}
      style={
        keyboard ? { top: keyboard.top, height: keyboard.height } : undefined
      }
    >
      {/*
        Normally sized by the screen's height, so the host, blanks and button fit
        under it. With the keyboard up it takes whatever room is left.
      */}
      <div
        className={cn(
          'flex justify-center',
          keyboard && 'flex-1 min-h-16 w-full items-end',
        )}
        style={keyboard ? { containerType: 'size' } : undefined}
      >
        <DuelDrawing
          round={round}
          alt={`${them.username}'s drawing`}
          className={cn(
            keyboard
              ? 'size-[min(100cqw,100cqh)] p-1 pb-2 [&>*]:size-full'
              : 'w-[clamp(7rem,100dvh-28.5rem,15rem)]',
          )}
        />
      </div>

      <HostSays
        host={duel.host}
        line={hostLine(round, them, guess.isPending)}
        compact
        className={cn(keyboard && 'hidden')}
      />

      {attempt <= MAX_GUESSES && (
        <form
          onSubmit={submit}
          onFocus={() => setTyping(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setTyping(false);
            }
          }}
          className="flex flex-none flex-col items-center gap-2 w-full"
        >
          <BlankSentence
            template={template}
            marks={marks}
            values={answers}
            selected={selected}
            onSelect={setPicked}
            onChange={(i, value) =>
              setAnswers((prev) => prev.map((a, j) => (j === i ? value : a)))
            }
            disabled={guess.isPending}
          />
          <Button
            size="sm"
            type="submit"
            disabled={!ready || guess.isPending}
            disableLoad
            // Keep the keyboard up when tapping guess, so the layout doesn't jump
            onPointerDown={(e) => e.preventDefault()}
          >
            {guess.isPending ? '…' : `guess (${attempt}/${MAX_GUESSES})`}
          </Button>
          {guess.isError && (
            <p className="text-sm text-coral">{guess.error.message}</p>
          )}
        </form>
      )}
    </div>
  );
};
