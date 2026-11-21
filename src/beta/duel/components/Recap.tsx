import { useNavigate } from '@tanstack/react-router';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { useCreateDuel } from '../api';
import { ScoreBadge } from './GuessFeedback';
import { HostSays } from './HostSays';
import { RoundCard } from './RoundCard';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import type { Duel } from '../api';
import Button from '@/components/Button';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

/** What happened, for a duel that ended early */
const endedEarly = (duel: Duel) => {
  if (duel.status === 'cancelled') return 'This duel was called off.';
  const stuck = duel.rounds.find((r) => !r.finished);
  if (!stuck) return '';
  const who = !stuck.drawn
    ? stuck.drawerId === duel.challenger.id
      ? duel.challenger
      : duel.opponent
    : stuck.guesserId === duel.challenger.id
      ? duel.challenger
      : duel.opponent;
  return `${who.username} never took their turn, so the duel timed out.`;
};

/**
 * The end: the host sums it up RPG style, the combined score lands, and both
 * rounds are laid out side by side. Then a rematch.
 */
export const Recap: FC<{ duel: Duel; them?: User }> = ({ duel, them }) => {
  const navigate = useNavigate();
  const rematch = useCreateDuel();
  const early = duel.status !== 'done' ? endedEarly(duel) : '';

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="flex items-center justify-center gap-4 py-2">
        <UserProfileIcon user={duel.challenger} size="xl" showLevel={false} />
        {duel.combined !== null ? (
          <ScoreBadge score={duel.combined} size="lg" animate />
        ) : (
          <span className="font-accent font-bold text-4xl">—</span>
        )}
        <UserProfileIcon user={duel.opponent} size="xl" showLevel={false} />
      </div>
      <p className="-mt-2 text-center text-pencil">
        {duel.combined === null
          ? 'no rounds were finished'
          : duel.complete
            ? 'your combined score: the average of both rounds'
            : 'from the one round you finished'}
      </p>

      {early && <p className="text-center">{early}</p>}

      <HostSays
        host={duel.host}
        line={duel.summary || 'Hold on, I am tallying it all up…'}
      />

      {duel.rounds.map((round) => (
        <RoundCard key={round.number} duel={duel} round={round} reveal />
      ))}

      {them && (
        <Button
          icon={faRotateRight}
          disabled={rematch.isPending}
          onClick={() =>
            rematch.mutate(them.id, {
              onSuccess: (next) =>
                navigate({
                  to: '/draw/beta/duel/$duelId',
                  params: { duelId: next.id },
                }),
              onError: (error) => {
                const existing = (error as Error & { duelId?: string }).duelId;
                if (existing)
                  navigate({
                    to: '/draw/beta/duel/$duelId',
                    params: { duelId: existing },
                  });
              },
            })
          }
        >
          rematch {them.username}
        </Button>
      )}
      {rematch.isError &&
        !(rematch.error as Error & { duelId?: string }).duelId && (
          <p className="text-coral">{rematch.error.message}</p>
        )}
    </div>
  );
};
