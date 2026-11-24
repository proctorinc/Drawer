import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faFlagCheckered,
  faMagnifyingGlass,
  faPencil,
} from '@fortawesome/free-solid-svg-icons';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import type { Duel } from '../api';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

type Step = {
  key: string;
  who: User | null;
  label: string;
  icon: typeof faPencil;
  state: 'done' | 'now' | 'later' | 'skipped';
  score?: number | null;
};

/** The duel's five steps, in order, and where it's at */
export const duelSteps = (duel: Duel): Array<Step> => {
  const { challenger: c, opponent: o } = duel;
  const [r1, r2] = duel.rounds;
  const over = duel.status !== 'active';
  const state = (done: boolean, now: boolean): Step['state'] =>
    done ? 'done' : now ? 'now' : over ? 'skipped' : 'later';

  return [
    {
      key: 'r1-draw',
      who: c,
      label: 'draws',
      icon: faPencil,
      state: state(r1.drawn, duel.round === 1 && duel.phase === 'draw'),
    },
    {
      key: 'r1-guess',
      who: o,
      label: 'guesses',
      icon: faMagnifyingGlass,
      state: state(r1.finished, duel.round === 1 && duel.phase === 'guess'),
      score: r1.score,
    },
    {
      key: 'r2-draw',
      who: o,
      label: 'draws',
      icon: faPencil,
      state: state(r2.drawn, duel.round === 2 && duel.phase === 'draw'),
    },
    {
      key: 'r2-guess',
      who: c,
      label: 'guesses',
      icon: faMagnifyingGlass,
      state: state(r2.finished, duel.round === 2 && duel.phase === 'guess'),
      score: r2.score,
    },
    {
      key: 'recap',
      who: null,
      label: 'recap',
      icon: faFlagCheckered,
      state: duel.status === 'done' ? 'done' : over ? 'now' : 'later',
      score: duel.combined,
    },
  ];
};

/**
 * Where the duel is at, as a strip of five steps: who draws, who guesses,
 * the other way round, then the recap. Yours are marked "you".
 */
export const DuelSteps: FC<{ duel: Duel; userId: string }> = ({
  duel,
  userId,
}) => (
  <ol className="grid grid-cols-5 gap-1 w-full" aria-label="duel steps">
    {duelSteps(duel).map((step, i) => (
      <li
        key={step.key}
        aria-current={step.state === 'now' ? 'step' : undefined}
        aria-label={`${step.who ? (step.who.id === userId ? 'you' : step.who.username) : ''} ${step.label}`.trim()}
        className={cn(
          'relative flex flex-col items-center gap-0.5 px-0.5 pt-1.5 pb-1 text-center border-2 rounded-sketch-alt transition-colors',
          step.state === 'now' && 'bg-butter border-ink -rotate-1',
          step.state === 'done' && 'bg-white border-ink',
          step.state === 'later' && 'border-dashed border-line',
          step.state === 'skipped' && 'border-dashed border-line opacity-50',
        )}
      >
        <span className="absolute -top-2 left-1 px-1 text-[0.65rem] leading-none font-bold bg-paper text-pencil">
          {i + 1}
        </span>
        {step.who ? (
          <UserProfileIcon user={step.who} size="xs" showLevel={false} />
        ) : (
          <span className="grid place-items-center size-6 text-xs border-[1.5px] border-ink rounded-full bg-white">
            <FontAwesomeIcon icon={step.icon} />
          </span>
        )}
        <span className="flex items-center gap-0.5 text-xs leading-none">
          {step.state === 'done' ? (
            <FontAwesomeIcon icon={faCheck} className="text-[0.6rem]" />
          ) : (
            step.who && (
              <FontAwesomeIcon icon={step.icon} className="text-[0.6rem]" />
            )
          )}
          {step.label}
        </span>
        {step.score != null && (
          <span className="text-[0.65rem] leading-none text-pencil">
            {step.score}%
          </span>
        )}
      </li>
    ))}
  </ol>
);
