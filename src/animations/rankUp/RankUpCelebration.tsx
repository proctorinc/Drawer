import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useStageHost } from '../StageHost';
import { BEATS, BEAT_ORDER, RIMS, intensityFor } from './intensity';
import { makeBurst, makeConfetti, makeSparkles, seedFor } from './pieces';
import type { Beat } from './intensity';
import type { CSSProperties } from 'react';
import type { StageComponent } from '../types';
import type { RankTier } from '@/levels/ranks';
import { RANK_TIERS, levelTitle, rankFor, tierRange } from '@/levels/ranks';
import { LevelBadge } from '@/levels/LevelBadge';
import { RankCard } from '@/levels/RankCard';
import { cn } from '@/utils';
import { rankUpSound } from '@/sound/sfx';
import './rankUp.css';

export { RANK_UP_INTENSITY } from './intensity';

/** Don't auto-finish within this long of the user touching or typing */
const IDLE_BEFORE_AUTO = 2500;

const step = (beat: Beat) => BEAT_ORDER.indexOf(beat);
const READY = step('ready');

// The crack's zigzag, in % of the badge; halves extend past it for sparks
const CRACK =
  '50% -60%, 50% 0%, 42% 18%, 58% 36%, 44% 56%, 60% 74%, 48% 100%, 48% 160%';
const LEFT_HALF = `polygon(-60% -60%, ${CRACK}, -60% 160%)`;
const RIGHT_HALF = `polygon(160% -60%, ${CRACK}, 160% 160%)`;

const reducedQuery = '(prefers-reduced-motion: reduce)';
function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia(reducedQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );

function tierById(id: string, fallback: RankTier): RankTier {
  return RANK_TIERS.find((tier) => tier.id === id) ?? fallback;
}

/**
 * Full screen: you crossed into a new rank tier. The tier's color floods the
 * screen, your old badge drops in, flips or cracks open into the new one, the
 * tier name is stamped onto a rank card and that tier's effects go off. How
 * big it gets comes from RANK_UP_INTENSITY: a tidy flip at Bronze up to a
 * rainbow takeover at Mythic.
 *
 * Tapping during the build-up skips to the end; after that, a tap anywhere,
 * the button or Escape finishes. It also finishes itself after a while, as
 * long as the user isn't in the middle of touching or typing.
 */
export const RankUpCelebration: StageComponent<'rankUp'> = ({
  payload,
  onDone,
}) => {
  const { host, preview } = useStageHost();
  const reduced = usePrefersReducedMotion();
  const to = tierById(payload.toTierId, rankFor(payload.level));
  const from = tierById(
    payload.fromTierId,
    rankFor(Math.max(1, payload.level - 1)),
  );
  const fx = intensityFor(to.id);
  const { pace } = fx;

  // The old badge shows the last level you had in the old tier
  const fromRange = tierRange(from);
  const oldLevel = Math.max(
    from.from,
    Math.min(payload.level - 1, fromRange.to ?? payload.level - 1),
  );

  const [played, setPlayed] = useState(0);
  const beat = reduced ? READY : played;
  const at = (name: Beat) => beat >= step(name);

  // Finish exactly once
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  // Play the beats
  useEffect(() => {
    if (reduced) return;
    const timers = BEAT_ORDER.slice(1).map((name, i) =>
      window.setTimeout(
        () => setPlayed((current) => Math.max(current, i + 1)),
        BEATS[name] * pace,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pace, reduced]);

  // The score: each beat's sounds as it's reached. A skip jumps several
  // beats at once, so the reveal and the fanfare still land together.
  const tierIndex = RANK_TIERS.findIndex((tier) => tier.id === to.id);
  const [sound] = useState(() =>
    rankUpSound({
      intensity: Math.max(0, tierIndex) / Math.max(1, RANK_TIERS.length - 1),
      pace,
      reveal: fx.reveal,
      confetti: fx.confetti > 0,
      sparkles: fx.sparkles > 0,
      sweep: fx.sheenSweep,
      buildUp: ((BEATS.new - BEATS.old) * pace) / 1000,
    }),
  );
  const heard = useRef(-1);
  useEffect(() => {
    const last = heard.current;
    if (beat <= last) return;
    heard.current = beat;
    const skipped = beat - last > 1;
    for (let i = last + 1; i <= beat; i++) {
      const name = BEAT_ORDER[i];
      // Jumping ahead skips the build-up's lead-in, not the payoff
      if (skipped && i < beat && (name === 'old' || name === 'turn')) {
        continue;
      }
      sound.beat(name);
    }
  }, [beat, sound]);
  useEffect(() => () => sound.stop(), [sound]);

  // Auto-finish, held off while the user is touching or typing
  const lastTouch = useRef(0);
  const pressing = useRef(false);
  useEffect(() => {
    let timer = 0;
    const check = () => {
      const now = Date.now();
      const idleFor = now - lastTouch.current;
      if (pressing.current || idleFor < IDLE_BEFORE_AUTO) {
        timer = window.setTimeout(
          check,
          pressing.current ? 500 : IDLE_BEFORE_AUTO - idleFor,
        );
        return;
      }
      finishRef.current();
    };
    timer = window.setTimeout(check, fx.autoMs);
    return () => window.clearTimeout(timer);
  }, [fx.autoMs]);

  // Keys: Escape finishes; anything else counts as interacting
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      lastTouch.current = Date.now();
      if (event.key === 'Escape') finishRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lock the page behind
  useEffect(() => {
    if (preview) return; // The admin's phone preview leaves the page alone
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [preview]);

  // Hand focus to the button once it's there
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isReady = beat >= READY;
  useEffect(() => {
    if (isReady) buttonRef.current?.focus({ preventScroll: true });
  }, [isReady]);

  const seed = seedFor(to.id);
  const size = fx.badgeSize;
  const confetti = useMemo(
    () => makeConfetti(fx.confetti, fx.palette, seed),
    [fx, seed],
  );
  const burst = useMemo(
    () => makeBurst(fx.burst, fx.palette, size * 1.25, seed + 1),
    [fx, size, seed],
  );
  const facets = useMemo(
    () => makeBurst(fx.facets, fx.palette, size * 1.05, seed + 2),
    [fx, size, seed],
  );
  const sparkles = useMemo(
    () => makeSparkles(fx.sparkles, size * 0.95, seed + 3),
    [fx, size, seed],
  );

  const onTap = () => {
    lastTouch.current = Date.now();
    // During the build-up a tap skips ahead rather than throwing it all away
    if (!at('new')) setPlayed(READY);
    else finish();
  };

  const flip = fx.reveal === 'flip';
  const wholeOld = at('old') && !at('new');
  const halves = !flip && at('new') && !at('ready') && !reduced;
  const motion = !reduced;
  const stage = Math.round(size * 1.9);
  const rimSize = size + 44;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rank-up-title"
      data-static={reduced || undefined}
      className="ru-root fixed inset-0 z-[1000] overflow-hidden bg-ink cursor-pointer"
      style={{ '--pace': pace } as CSSProperties}
      onClick={onTap}
      onPointerDown={() => {
        pressing.current = true;
        lastTouch.current = Date.now();
      }}
      onPointerUp={() => {
        pressing.current = false;
        lastTouch.current = Date.now();
      }}
      onPointerCancel={() => {
        pressing.current = false;
      }}
    >
      {/* Backdrop: the tier's color floods in, then (Mythic) the rainbow */}
      <div
        aria-hidden="true"
        className={cn('ru-wash absolute inset-0', fx.washSpins && 'rank-spin')}
        style={{ background: fx.wash }}
      />
      {fx.takeover && at('stamp') && (
        <div
          aria-hidden="true"
          className="ru-takeover rank-spin absolute inset-0"
          style={{ background: fx.takeover }}
        />
      )}
      <div aria-hidden="true" className="ru-dots absolute inset-0" />
      {motion && fx.sheenSweep && at('stamp') && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <span className="ru-sweep" />
        </div>
      )}

      {/* Paper confetti over everything but the card */}
      {motion && at('stamp') && confetti.length > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden pointer-events-none"
        >
          {confetti.map((piece, i) => (
            <span
              key={i}
              className="ru-confetti"
              style={
                {
                  left: `${piece.left}%`,
                  width: piece.width,
                  height: piece.height,
                  background: piece.color,
                  borderRadius: piece.round ? '9999px' : 2,
                  '--delay': `${piece.delay * pace}s`,
                  '--duration': `${piece.duration * pace}s`,
                  '--drift': `${piece.drift}px`,
                  '--spin': `${piece.spin}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div className="relative flex flex-col items-center justify-center min-h-full px-4 py-6 gap-1">
        {/* "Rank up!" tag */}
        <div className="h-14 flex items-end">
          {at('stamp') && (
            <span className="ru-tag-in inline-block px-4 py-1 bg-paper text-ink border-2 border-ink rounded-sketch -rotate-3 font-accent font-bold text-4xl leading-none">
              Rank up!
            </span>
          )}
        </div>

        {/* The badge stage */}
        <div
          className="relative flex-none grid place-items-center"
          style={{ width: stage, height: stage, maxWidth: '100%' }}
        >
          {fx.rays > 0 && at('new') && (
            <span
              aria-hidden="true"
              className="ru-rays absolute rounded-full pointer-events-none"
              style={{
                width: 'min(150cqw, 620px)',
                height: 'min(150cqw, 620px)',
                left: '50%',
                top: '50%',
                marginLeft: 'max(-75cqw, -310px)',
                marginTop: 'max(-75cqw, -310px)',
                background: `repeating-conic-gradient(rgb(255 255 255 / 0.2) 0 ${180 / fx.rays}deg, transparent 0 ${360 / fx.rays}deg)`,
              }}
            />
          )}

          {fx.rim && at('new') && (
            <span
              aria-hidden="true"
              className="ru-rim absolute pointer-events-none"
              style={{
                width: rimSize,
                height: rimSize,
                left: '50%',
                top: '50%',
                margin: -rimSize / 2,
              }}
            >
              <span
                className="rank-spin absolute inset-0 rounded-full border-[2.5px] border-ink"
                style={{
                  background: RIMS[fx.rim],
                  // Punch the middle out with a hard edge, leaving a band
                  mask: 'radial-gradient(circle, transparent 0 calc(50% - 14px), #000 calc(50% - 14px))',
                  WebkitMask:
                    'radial-gradient(circle, transparent 0 calc(50% - 14px), #000 calc(50% - 14px))',
                }}
              />
              <span className="absolute inset-[11px] rounded-full border-[2.5px] border-ink" />
            </span>
          )}

          {motion &&
            at('new') &&
            Array.from({ length: fx.rings }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="absolute pointer-events-none"
                style={{
                  width: size,
                  height: size,
                  left: '50%',
                  top: '50%',
                  margin: -size / 2,
                }}
              >
                <span
                  className="ru-ring"
                  style={{
                    borderColor: fx.ringColor ?? to.glow ?? '#ffffff',
                    borderWidth: 4,
                    animationDelay: `${(i * 2200 * pace) / fx.rings}ms`,
                  }}
                />
              </span>
            ))}

          <div
            className="ru-turn-stage relative"
            style={{ width: size, height: size }}
          >
            {wholeOld && (
              <div
                className={cn(
                  'absolute inset-0',
                  at('turn')
                    ? flip
                      ? 'ru-flip-out'
                      : 'ru-shake'
                    : 'ru-old-in',
                )}
              >
                <LevelBadge level={oldLevel} size={size} />
                {!flip && at('turn') && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 100 100"
                    className="absolute inset-0 overflow-visible"
                  >
                    <polyline
                      className="ru-crack-line"
                      points="50,-4 42,18 58,36 44,56 60,74 48,104"
                      fill="none"
                      stroke="var(--color-ink)"
                      strokeWidth="4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
            )}

            {halves &&
              [LEFT_HALF, RIGHT_HALF].map((clip, i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="ru-half absolute inset-0 pointer-events-none"
                  style={
                    {
                      clipPath: clip,
                      '--dir': i === 0 ? -1 : 1,
                    } as CSSProperties
                  }
                >
                  <LevelBadge level={oldLevel} size={size} />
                </div>
              ))}

            {at('new') && (
              <div
                className={cn(
                  'absolute inset-0',
                  flip ? 'ru-flip-in' : 'ru-pop-in',
                )}
              >
                <LevelBadge level={payload.level} size={size} />
              </div>
            )}
          </div>

          {motion && at('new') && (
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
            >
              {Array.from({ length: fx.popLines }, (_, i) => (
                <span
                  key={`line${i}`}
                  className="ru-pop-line"
                  style={
                    {
                      '--angle': `${(i / fx.popLines) * 360}deg`,
                      '--r': `${size / 2 + 10}px`,
                      animationDelay: `${120 * pace}ms`,
                    } as CSSProperties
                  }
                />
              ))}
              {burst.map((piece, i) => (
                <span
                  key={`burst${i}`}
                  className="ru-fling border-[1.5px] border-ink"
                  style={
                    {
                      width: piece.size,
                      height: piece.size * 1.4,
                      borderRadius: 2,
                      background: piece.color,
                      animationDelay: `${piece.delay * pace}s`,
                      '--x': `${piece.x}px`,
                      '--y': `${piece.y}px`,
                      '--spin': `${piece.spin}deg`,
                    } as CSSProperties
                  }
                />
              ))}
              {facets.map((piece, i) => (
                <svg
                  key={`facet${i}`}
                  viewBox="0 0 20 28"
                  className="ru-fling ru-fling-slow overflow-visible"
                  width={piece.size * 1.8}
                  height={piece.size * 2.5}
                  style={
                    {
                      animationDelay: `${piece.delay * pace}s`,
                      '--x': `${piece.x}px`,
                      '--y': `${piece.y}px`,
                      '--spin': `${piece.spin}deg`,
                    } as CSSProperties
                  }
                >
                  <polygon
                    points="10,0 20,10 10,28 0,10"
                    fill={piece.color}
                    stroke="var(--color-ink)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="0,10 20,10"
                    fill="none"
                    stroke="var(--color-ink)"
                    strokeWidth="1.2"
                  />
                </svg>
              ))}
            </div>
          )}

          {at('new') &&
            sparkles.map((spark, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="rank-spark pointer-events-none"
                style={{
                  left: `calc(50% + ${spark.x - spark.size / 2}px)`,
                  top: `calc(50% + ${spark.y - spark.size / 2}px)`,
                  width: spark.size,
                  height: spark.size,
                  background: to.holo ? '#ffffff' : '#ffe27a',
                  animationDelay: `${spark.delay}s`,
                }}
              />
            ))}
        </div>

        {/* The rank card with the stamped name and the button */}
        <div
          className={cn(
            'w-full max-w-[320px] mt-4',
            at('stamp') ? 'ru-card-in' : 'invisible',
          )}
        >
          <RankCard
            level={payload.level}
            pin
            contentClassName="flex flex-col items-center gap-3 px-5 pt-7 pb-5 text-center"
          >
            <div className={cn(at('stamp') && 'ru-thump')}>
              <h2
                id="rank-up-title"
                className={cn(
                  'inline-flex flex-wrap items-center justify-center gap-x-2 px-3 py-1 border-[3px] border-current rounded-sketch font-accent font-bold leading-none uppercase -rotate-4',
                  from.name.length + to.name.length > 12
                    ? 'text-2xl'
                    : 'text-3xl',
                  at('stamp') && 'ru-stamp',
                )}
              >
                <span className="opacity-55 line-through decoration-2">
                  {from.name}
                </span>
                <span aria-label="to">→</span>
                <span>{to.name}</span>
              </h2>
            </div>
            <p className="flex flex-col items-center gap-1 text-pencil text-lg leading-tight">
              <span>
                Level {payload.level} ·{' '}
                <span className="font-accent font-bold text-xl text-ink">
                  <span className="highlight">
                    {levelTitle(payload.level).toLowerCase()}
                  </span>
                </span>
              </span>
              <span>Welcome to {to.name}!</span>
            </p>
            <button
              ref={buttonRef}
              type="button"
              tabIndex={isReady ? 0 : -1}
              onClick={(event) => {
                event.stopPropagation();
                finish();
              }}
              className={cn(
                'press inline-flex justify-center items-center px-7 py-2.5 cursor-pointer font-accent font-bold text-2xl leading-none border-2 border-ink rounded-sketch shadow-pencil hover:-rotate-1',
                isReady ? motion && 'ru-button-in' : 'invisible',
              )}
              style={{
                background: fx.button?.background ?? 'var(--color-ink)',
                color: fx.button?.color ?? 'var(--color-paper)',
              }}
            >
              Nice!
            </button>
          </RankCard>
        </div>
      </div>
    </div>,
    host,
  );
};

/** Handy for a demo: every tier's id, lowest first */
export const RANK_UP_TIER_IDS: Array<string> = RANK_TIERS.map(
  (tier) => tier.id,
);
