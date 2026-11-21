import { DuelDrawing } from './GuessTurn';
import { GuessRow, KeywordSlots, ScoreBadge } from './GuessFeedback';
import type { FC, ReactNode } from 'react';
import type { User } from '@/api/Api';
import type { Duel, DuelRound } from '../api';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

/** "a shark stuck in a bathtub" with the keywords underlined */
export const MarkedPrompt: FC<{ round: DuelRound }> = ({ round }) => {
  const prompt = round.prompt;
  if (!prompt) return <span className="text-pencil">a secret prompt</span>;
  // Underline each keyword where it first appears
  const parts: Array<ReactNode> = [];
  let rest = prompt;
  let key = 0;
  while (rest) {
    const lower = rest.toLowerCase();
    let at = -1;
    let found = '';
    for (const keyword of round.keywords) {
      const i = lower.indexOf(keyword.toLowerCase());
      if (i !== -1 && (at === -1 || i < at)) {
        at = i;
        found = keyword;
      }
    }
    if (at === -1) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, at));
    parts.push(
      <span
        key={key++}
        className="underline decoration-wavy decoration-2 underline-offset-4"
      >
        {rest.slice(at, at + found.length)}
      </span>,
    );
    rest = rest.slice(at + found.length);
  }
  return <>{parts}</>;
};

const playerOf = (duel: Duel, id: string): User =>
  duel.challenger.id === id ? duel.challenger : duel.opponent;

/**
 * A round laid out: who drew what, the drawing, the keywords and every guess.
 * Used for the reveal after you guess, while watching, and in the recap.
 */
export const RoundCard: FC<{
  duel: Duel;
  round: DuelRound;
  /** Show the missed keywords too */
  reveal?: boolean;
  /** Flip in the guesses from this attempt on */
  freshFrom?: number;
  className?: string;
}> = ({ duel, round, reveal = round.finished, freshFrom, className }) => {
  const drawer = playerOf(duel, round.drawerId);
  const guesser = playerOf(duel, round.guesserId);

  return (
    <section
      className={cn(
        'flex flex-col gap-4 w-full p-4 bg-white border-2 border-ink rounded-sketch',
        className,
      )}
    >
      <header className="flex items-center gap-2">
        <UserProfileIcon user={drawer} size="sm" showLevel={false} />
        <span className="flex-1 min-w-0 leading-tight">
          <b className="font-accent text-xl">round {round.number}</b>
          <span className="block text-sm text-pencil truncate">
            {drawer.username} drew, {guesser.username} guessed
          </span>
        </span>
        {round.score !== null && <ScoreBadge score={round.score} size="sm" />}
      </header>

      <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-4 items-start">
        {round.drawn ? (
          <DuelDrawing round={round} alt={`${drawer.username}'s drawing`} />
        ) : (
          <div className="grid place-items-center aspect-square p-2 text-sm text-center text-pencil border-2 border-dashed border-line">
            never drawn
          </div>
        )}
        <div className="flex flex-col gap-2 min-w-0">
          <span className="text-sm text-pencil">the prompt</span>
          <p className="font-accent font-bold text-2xl leading-tight">
            <MarkedPrompt round={round} />
          </p>
        </div>
      </div>

      {round.guesses.length > 0 && (
        <>
          <KeywordSlots round={round} reveal={reveal} />
          <ul className="flex flex-col gap-3">
            {round.guesses.map((g) => (
              <GuessRow
                key={g.attempt}
                guess={g}
                fresh={freshFrom !== undefined && g.attempt >= freshFrom}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
