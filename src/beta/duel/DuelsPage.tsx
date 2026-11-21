import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFlask,
  faMagnifyingGlass,
  faPencil,
} from '@fortawesome/free-solid-svg-icons';
import { formatDistanceToNowStrict } from 'date-fns';
import { isYourTurn, sides, useCreateDuel, useDuels } from './api';
import { ScoreBadge } from './components/GuessFeedback';
import { BetaGate } from './BetaGate';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import type { Duel } from './api';
import Button from '@/components/Button';
import Layout from '@/components/Layout';
import useUser from '@/auth/hooks/useUser';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

/** One line on where a duel is at, from your side */
const status = (duel: Duel, userId: string) => {
  const { them } = sides(duel, userId);
  switch (duel.status) {
    case 'done':
      return 'finished';
    case 'expired':
      return 'timed out';
    case 'cancelled':
      return 'called off';
  }
  if (isYourTurn(duel, userId))
    return duel.phase === 'draw' ? 'your turn to draw' : 'your turn to guess';
  if (duel.otherHereNow) return `${them.username} is playing right now`;
  return duel.phase === 'draw'
    ? `waiting for ${them.username} to draw`
    : `waiting for ${them.username} to guess`;
};

const DuelRow: FC<{ duel: Duel; userId: string }> = ({ duel, userId }) => {
  const { them } = sides(duel, userId);
  const yours = isYourTurn(duel, userId);
  return (
    <Link
      to="/draw/beta/duel/$duelId"
      params={{ duelId: duel.id }}
      className={cn(
        'flex items-center gap-3 w-full p-3 border-2 rounded-sketch-alt transition-transform hover:-rotate-1',
        yours ? 'bg-butter border-ink' : 'bg-white border-ink',
        duel.status !== 'active' && 'border-line',
      )}
    >
      <UserProfileIcon user={them} size="lg" showLevel={false} />
      <span className="flex-1 min-w-0 leading-tight">
        <b className="font-accent text-xl">{them.username}</b>
        <span className="block text-sm text-pencil truncate">
          {status(duel, userId)} ·{' '}
          {formatDistanceToNowStrict(new Date(duel.updatedAt))} ago
        </span>
      </span>
      {duel.combined !== null && duel.status !== 'active' ? (
        <ScoreBadge score={duel.combined} />
      ) : yours ? (
        <FontAwesomeIcon
          icon={duel.phase === 'draw' ? faPencil : faMagnifyingGlass}
          className="text-2xl"
        />
      ) : null}
    </Link>
  );
};

/** How a duel goes, in four steps */
const HowItWorks = () => (
  <ol className="flex flex-col gap-2 w-full p-4 bg-white border-2 border-ink rounded-sketch">
    {[
      'you get a secret prompt and 60 seconds to draw it',
      'your partner gets 3 guesses. the AI scores how much of the meaning they caught: green for got it, yellow for close',
      'then they draw one for you, and you guess',
      'your two scores average into one team score. aim for 100%!',
    ].map((step, i) => (
      <li key={i} className="flex gap-3">
        <span className="grid place-items-center flex-none size-7 font-accent font-bold bg-butter border-2 border-ink rounded-full">
          {i + 1}
        </span>
        <span className="leading-snug">{step}</span>
      </li>
    ))}
    <li className="pt-1 text-sm text-pencil">
      no need to be online together: you&apos;ll get a notification when
      it&apos;s your turn. if you are both here, you&apos;ll see each other play
      live.
    </li>
  </ol>
);

const Challenge: FC<{
  opponents: Array<User>;
  duels: Array<Duel>;
  userId: string;
}> = ({ opponents, duels, userId }) => {
  const navigate = useNavigate();
  const create = useCreateDuel();
  const [picked, setPicked] = useState<string | null>(null);
  const busyWith = new Set(
    duels
      .filter((d) => d.status === 'active')
      .map((d) => sides(d, userId).them.id),
  );

  if (opponents.length === 0) {
    return (
      <p className="text-center text-pencil">
        nobody else is in the beta yet. add a tester from the admin beta zone.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex flex-wrap justify-center gap-3">
        {opponents.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setPicked(o.id)}
            className={cn(
              'flex flex-col items-center gap-1 p-2 border-2 rounded-sketch-alt cursor-pointer',
              picked === o.id ? 'bg-butter border-ink' : 'border-transparent',
            )}
          >
            <UserProfileIcon user={o} size="lg" showLevel={false} />
            <span className="text-sm">{o.username}</span>
            {busyWith.has(o.id) && (
              <span className="text-xs text-pencil">duel going</span>
            )}
          </button>
        ))}
      </div>
      <Button
        disabled={!picked || create.isPending}
        onClick={() =>
          picked &&
          create.mutate(picked, {
            onSuccess: (duel) =>
              navigate({
                to: '/draw/beta/duel/$duelId',
                params: { duelId: duel.id },
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
        {picked && busyWith.has(picked) ? 'back to your duel' : 'start a duel'}
      </Button>
      {create.isError &&
        !(create.error as Error & { duelId?: string }).duelId && (
          <p className="text-coral">{create.error.message}</p>
        )}
    </div>
  );
};

/** The beta lab's sketch duels: start one, and every duel you're in */
const DuelsPage = () => {
  const user = useUser();
  const duels = useDuels();

  return (
    <BetaGate>
      <Layout back>
        <header className="flex flex-col items-center gap-1 text-center">
          <span className="flex items-center gap-1.5 px-2 py-0.5 text-sm bg-sky border-2 border-ink rounded-full">
            <FontAwesomeIcon icon={faFlask} /> beta lab
          </span>
          <h1 className="font-accent font-bold text-4xl leading-none">
            sketch duel
          </h1>
          <p className="text-pencil">a co-op pictionary for two</p>
        </header>

        {duels.isPending ? (
          <p className="text-pencil">loading…</p>
        ) : duels.isError ? (
          <p className="text-coral">{duels.error.message}</p>
        ) : (
          <>
            <HowItWorks />
            <section className="flex flex-col items-center gap-3 w-full">
              <h2 className="font-accent font-bold text-2xl">
                challenge someone
              </h2>
              <Challenge
                opponents={duels.data.opponents}
                duels={duels.data.duels}
                userId={user.id}
              />
            </section>
            {duels.data.duels.length > 0 && (
              <section className="flex flex-col gap-2 w-full">
                <h2 className="font-accent font-bold text-2xl">your duels</h2>
                {[...duels.data.duels]
                  .sort(
                    (a, b) =>
                      Number(isYourTurn(b, user.id)) -
                      Number(isYourTurn(a, user.id)),
                  )
                  .map((duel) => (
                    <DuelRow key={duel.id} duel={duel} userId={user.id} />
                  ))}
              </section>
            )}
          </>
        )}
      </Layout>
    </BetaGate>
  );
};

export default DuelsPage;
