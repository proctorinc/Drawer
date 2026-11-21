import { useRef, useState } from 'react';
import { MAX_GUESSES, useGuess } from '../api';
import { GuessRow, KeywordSlots, TileLegend } from './GuessFeedback';
import { HostSays } from './HostSays';
import type { FC, FormEvent } from 'react';
import type { User } from '@/api/Api';
import type { Duel, DuelRound } from '../api';
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

/** What the host says, given how the guessing is going */
const hostLine = (round: DuelRound, them: User, scoring: boolean) => {
  const last = round.guesses.at(-1);
  if (scoring) return 'Hmm, let me hold that up to the drawing…';
  if (!last) {
    return `${them.username} drew you something in ${round.keywordCount} key ${
      round.keywordCount === 1 ? 'part' : 'parts'
    }. You get ${MAX_GUESSES} guesses: I'll score how much of the meaning you catch, no need for the exact words.`;
  }
  const left = MAX_GUESSES - round.guesses.length;
  return `${last.note || `That's ${last.score}%.`} ${
    left > 0
      ? `${left} ${left === 1 ? 'guess' : 'guesses'} left. Green stays found; work on the rest.`
      : ''
  }`.trim();
};

/**
 * Your turn to guess: their drawing big, the prompt's keywords as slots that
 * fill in, and up to three guesses, each scored with colored tiles and notes.
 */
export const GuessTurn: FC<{ duel: Duel; round: DuelRound; them: User }> = ({
  duel,
  round,
  them,
}) => {
  const guess = useGuess(duel.id);
  const [text, setText] = useState('');
  // Guesses made on this screen flip in; ones from before just sit there
  const firstFresh = useRef(round.guesses.length + 1);
  const attempt = round.guesses.length + 1;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || guess.isPending) return;
    guess.mutate(value, { onSuccess: () => setText('') });
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <DuelDrawing
        round={round}
        alt={`${them.username}'s drawing`}
        className="w-full max-w-xs"
      />

      <div className="flex flex-col items-center gap-2 w-full">
        <span className="text-sm text-pencil">the prompt&apos;s key parts</span>
        <KeywordSlots round={round} />
      </div>

      <HostSays
        host={duel.host}
        line={hostLine(round, them, guess.isPending)}
      />

      {round.guesses.length > 0 && (
        <ul className="flex flex-col gap-3 w-full">
          {round.guesses.map((g) => (
            <GuessRow
              key={g.attempt}
              guess={g}
              fresh={g.attempt >= firstFresh.current}
            />
          ))}
        </ul>
      )}
      {round.guesses.length > 0 && <TileLegend />}

      {attempt <= MAX_GUESSES && (
        <form onSubmit={submit} className="flex flex-col gap-2 w-full">
          <label htmlFor="duel-guess" className="text-pencil">
            guess {attempt} of {MAX_GUESSES}
          </label>
          <div className="flex gap-2">
            <input
              id="duel-guess"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={80}
              autoComplete="off"
              autoFocus
              disabled={guess.isPending}
              placeholder="e.g. a cat napping on a laptop"
              className="flex-1 min-w-0 px-3 py-2 text-xl bg-white border-2 border-ink rounded-sketch-alt disabled:opacity-60"
            />
            <Button
              size="sm"
              type="submit"
              disabled={!text.trim() || guess.isPending}
              disableLoad
            >
              {guess.isPending ? '…' : 'guess'}
            </Button>
          </div>
          {guess.isError && <p className="text-coral">{guess.error.message}</p>}
        </form>
      )}
    </div>
  );
};
