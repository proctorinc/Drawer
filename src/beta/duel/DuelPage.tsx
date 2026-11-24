import { useCallback, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { currentRound, isYourTurn, sides, useDuel } from './api';
import { ClashBadge, DuelClash } from './components/DuelClash';
import { DuelSteps } from './components/DuelSteps';
import { DrawTurn } from './components/DrawTurn';
import { GuessTurn } from './components/GuessTurn';
import { HostSays } from './components/HostSays';
import { Recap } from './components/Recap';
import { RoundCard } from './components/RoundCard';
import { Waiting } from './components/Waiting';
import { BetaGate } from './BetaGate';
import type { FC } from 'react';
import type { Duel, DuelRound } from './api';
import Button from '@/components/Button';
import Layout from '@/components/Layout';
import Masthead from '@/components/Masthead';
import useUser from '@/auth/hooks/useUser';

// Per device: which duels have played their intro, and which finished rounds you've seen
const readList = (key: string): Array<string> => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
};
const addToList = (key: string, item: string) => {
  try {
    const list = [item, ...readList(key).filter((x) => x !== item)];
    localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
  } catch {
    // Blocked storage: the intro may play again, which is fine
  }
};
const INTRO_KEY = 'duel-intros-seen';
const ROUNDS_KEY = 'duel-rounds-seen';

/**
 * The round you just finished guessing, until you've looked at it: otherwise
 * the screen would jump straight on and you'd never see your last guess land.
 */
const unseenGuessedRound = (duel: Duel, userId: string, seen: Array<string>) =>
  duel.rounds.find(
    (r) =>
      r.finished &&
      r.guesserId === userId &&
      !seen.includes(`${duel.id}:${r.number}`),
  );

const RoundReveal: FC<{
  duel: Duel;
  round: DuelRound;
  onNext: () => void;
}> = ({ duel, round, onNext }) => {
  const best = round.score ?? 0;
  const perfect = round.guesses.some((g) => g.exact);
  const line = perfect
    ? `Perfect! "${round.prompt}". ${best}%.`
    : `It was "${round.prompt}". You got ${best}%.`;
  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <HostSays host={duel.host} line={line}>
        <Button className="w-full" onClick={onNext} disableLoad>
          {duel.status === 'active' && round.number === 1
            ? 'your turn to draw'
            : 'see results'}
        </Button>
      </HostSays>
      <RoundCard
        duel={duel}
        round={round}
        reveal
        freshFrom={round.guesses.length}
      />
    </div>
  );
};

const DuelBody: FC<{ duel: Duel; userId: string }> = ({ duel, userId }) => {
  const { playing, them } = sides(duel, userId);
  const [seenRounds, setSeenRounds] = useState(() => readList(ROUNDS_KEY));

  if (!playing) {
    // An admin looking in: every round, prompts and all
    return <Recap duel={duel} />;
  }

  const unseen = unseenGuessedRound(duel, userId, seenRounds);
  if (unseen) {
    return (
      <RoundReveal
        duel={duel}
        round={unseen}
        onNext={() => {
          addToList(ROUNDS_KEY, `${duel.id}:${unseen.number}`);
          setSeenRounds(readList(ROUNDS_KEY));
        }}
      />
    );
  }

  if (duel.status !== 'active') return <Recap duel={duel} them={them} />;

  const round = currentRound(duel)!;
  if (!isYourTurn(duel, userId)) return <Waiting duel={duel} them={them} />;
  if (duel.phase === 'guess')
    return <GuessTurn duel={duel} round={round} them={them} />;

  // Drawing round 2 straight after guessing round 1: say how that went first
  const before = round.number === 2 ? duel.rounds[0] : undefined;
  return (
    <DrawTurn
      duel={duel}
      round={round}
      them={them}
      lead={
        before?.score != null ? `Round 1 done at ${before.score}%!` : undefined
      }
    />
  );
};

const DuelPage = () => {
  const { duelId } = useParams({ from: '/_app/draw/beta/duel/$duelId' });
  const user = useUser();
  const duel = useDuel(duelId, user.id);
  const [intro, setIntro] = useState(
    () => !readList(INTRO_KEY).includes(duelId),
  );
  const endIntro = useCallback(() => {
    addToList(INTRO_KEY, duelId);
    setIntro(false);
  }, [duelId]);

  return (
    <BetaGate>
      <Layout
        back
        noNavbar
        masthead={
          <Masthead
            back
            title={
              duel.data ? (
                <ClashBadge
                  left={duel.data.challenger}
                  right={duel.data.opponent}
                />
              ) : null
            }
            right={null}
          />
        }
      >
        {duel.isPending ? (
          <p className="py-10 text-pencil">loading the duel…</p>
        ) : duel.isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-coral">{duel.error.message}</p>
            <Link to="/draw/beta" className="underline">
              back to your duels
            </Link>
          </div>
        ) : (
          <>
            {intro && sides(duel.data, user.id).playing && (
              <DuelClash
                left={duel.data.challenger}
                right={duel.data.opponent}
                onDone={endIntro}
              />
            )}
            <DuelSteps duel={duel.data} userId={user.id} />
            <DuelBody duel={duel.data} userId={user.id} />
          </>
        )}
      </Layout>
    </BetaGate>
  );
};

export default DuelPage;
