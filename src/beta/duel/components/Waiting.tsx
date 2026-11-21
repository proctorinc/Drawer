import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faHandPointRight } from '@fortawesome/free-solid-svg-icons';
import { formatDistanceToNowStrict } from 'date-fns';
import { clockOffset, currentRound, useCancelDuel, useNudge } from '../api';
import { DrawClock, useSecondsLeft } from './DrawTurn';
import { HostSays } from './HostSays';
import { RoundCard } from './RoundCard';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import type { Duel } from '../api';
import Button from '@/components/Button';
import { useNotifications } from '@/notifications/NotificationContext';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

/** Whether the other player is here right now, or when they last were */
export const Presence: FC<{ duel: Duel; them: User }> = ({ duel, them }) => (
  <div className="flex items-center gap-3">
    <span className="relative">
      <UserProfileIcon user={them} size="lg" showLevel={false} />
      <span
        className={cn(
          'absolute -right-0.5 -bottom-0.5 size-4 border-2 border-ink rounded-full',
          duel.otherHereNow ? 'duel-ping bg-[#7fd36b]' : 'bg-line',
        )}
      />
    </span>
    <span className="leading-tight">
      <b className="font-accent text-xl">{them.username}</b>
      <span className="block text-sm text-pencil">
        {duel.otherHereNow
          ? 'here right now'
          : duel.otherSeenAt
            ? `last here ${formatDistanceToNowStrict(new Date(duel.otherSeenAt))} ago`
            : "hasn't opened this duel yet"}
      </span>
    </span>
  </div>
);

/** What's happening on their side, in the host's words */
const waitingLine = (
  duel: Duel,
  them: User,
  drawing: boolean,
  timeUp: boolean,
) => {
  const round = currentRound(duel)!;
  const name = them.username;
  if (duel.phase === 'draw') {
    if (drawing)
      return `${name} is drawing for you right now! Their clock is ticking…`;
    if (timeUp)
      return `${name}'s minute is up. Their drawing lands as soon as their app catches up.`;
    if (duel.otherHereNow)
      return `${name} is here, staring at the start button. Any second now…`;
    return round.number === 1
      ? `I've told ${name} it's their turn to draw. You'll be up as soon as they're done.`
      : `${name} owes you a drawing. I've sent them a notification; you'll get one back when it's your turn.`;
  }
  if (round.guesses.length && duel.otherHereNow)
    return `${name} is guessing live! Watch their tries come in below.`;
  if (duel.otherHereNow) return `${name} is looking at your drawing right now…`;
  return `Your drawing's with ${name}. I'll ping you when they've had their guesses.`;
};

/** Turn on push, so you find out when it's your turn */
const NotifyMe = () => {
  const { isSupported, subscription, subscribeToPush, hasChecked } =
    useNotifications();
  if (!isSupported || !hasChecked || subscription) return null;
  return (
    <div className="flex items-center gap-3 w-full p-3 bg-sky border-2 border-ink rounded-sketch-alt">
      <FontAwesomeIcon icon={faBell} className="text-xl" />
      <span className="flex-1 text-sm leading-tight">
        turn on notifications so you hear the moment it&apos;s your turn
      </span>
      <Button size="sm" variant="base" onClick={() => subscribeToPush()}>
        turn on
      </Button>
    </div>
  );
};

/**
 * Not your turn. Shows what the other player is up to (live when they're here),
 * lets you nudge them, says when it'll give up on them, and lets you call it off.
 */
export const Waiting: FC<{ duel: Duel; them: User }> = ({ duel, them }) => {
  const round = currentRound(duel)!;
  const nudge = useNudge(duel.id);
  const cancel = useCancelDuel(duel.id);
  const [confirming, setConfirming] = useState(false);
  const offset = clockOffset(duel);
  const seconds = useSecondsLeft(
    duel.phase === 'draw' ? round.drawDeadline : null,
    offset,
  );
  const drawing = seconds !== null && seconds > 0;
  const timeUp = seconds !== null && seconds <= 0;
  const nudgeWait =
    duel.nudgeAvailableAt &&
    new Date(duel.nudgeAvailableAt).getTime() > Date.now() + offset;

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <HostSays
        host={duel.host}
        line={waitingLine(duel, them, drawing, timeUp)}
      />

      <div className="flex flex-col gap-3 w-full p-4 bg-white border-2 border-ink rounded-sketch">
        <Presence duel={duel} them={them} />
        {drawing && <DrawClock seconds={seconds} />}
        {!duel.otherHereNow && !drawing && (
          <Button
            size="sm"
            variant="base"
            icon={faHandPointRight}
            disabled={!!nudgeWait || nudge.isPending}
            onClick={() => nudge.mutate()}
            disableLoad
          >
            {nudgeWait
              ? `nudged · again in ${formatDistanceToNowStrict(new Date(duel.nudgeAvailableAt!))}`
              : `nudge ${them.username}`}
          </Button>
        )}
        {nudge.isError && (
          <p className="text-sm text-coral">{nudge.error.message}</p>
        )}
        {duel.expiresAt && (
          <p className="text-sm text-pencil">
            if {them.username} doesn&apos;t play within{' '}
            {formatDistanceToNowStrict(new Date(duel.expiresAt))}, the duel ends
            and you keep whatever you&apos;ve scored so far.
          </p>
        )}
      </div>

      <NotifyMe />

      {/* You drew it, so you see everything: watch their guesses land */}
      {duel.phase === 'guess' && (
        <RoundCard
          duel={duel}
          round={round}
          reveal
          freshFrom={round.guesses.length}
        />
      )}

      <div className="flex flex-col items-center gap-2">
        {confirming ? (
          <>
            <span className="text-pencil">
              call off the duel for both of you?
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="base"
                onClick={() => setConfirming(false)}
                disableLoad
              >
                keep playing
              </Button>
              <Button
                size="sm"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                disableLoad
              >
                call it off
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-pencil underline underline-offset-2 cursor-pointer"
          >
            call off this duel
          </button>
        )}
      </div>
    </div>
  );
};
