import { useLayoutEffect, useRef, useState } from 'react';
import { GRADE_NAMES, compactOdds } from './mint';
import type { MintCard, PopNumbers } from './mint';
import type {
  CSSProperties,
  FC,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { GoldTrim } from '@/ai/Masterpiece';
import { formatScore } from '@/ai/score';
import { PushPin } from '@/components/PushPin';
import LogoIcon from '@/components/logo/LogoIcon';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';
import './minted.css';

const formatDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Corner wear and scuffs from the condition roll, drawn flat */
const Wear: FC<{ card: MintCard }> = ({ card }) => (
  <>
    {card.cond.corners <= 6 && (
      <svg className="mint-fold" viewBox="0 0 22 22" aria-hidden="true">
        <path d="M22 0V22H0z" fill="var(--color-paper)" />
        <path
          d="M22 0L0 22h18q4 0 4-4z"
          fill="#e9dfc8"
          stroke="var(--color-ink)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    )}
    {card.cond.surface <= 6 && (
      <svg
        className="mint-scuffs"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M12 30l34-9M58 74l28-14M20 82l18-4"
          stroke="rgb(106 100 117 / 0.55)"
          strokeWidth=".9"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    )}
  </>
);

const Front: FC<{ card: MintCard }> = ({ card }) => {
  const { source: s, tier } = card;
  const off = (10 - card.cond.centering) * 0.6;
  const marks = [
    card.serial === 1 && '1ST',
    card.mood === 'love' && '♥ SMITTEN',
    card.mood === 'hate' && 'GRUDGE',
  ].filter(Boolean);

  return (
    <div className={cn('mint-face', `mint-t-${tier.id}`)}>
      {(tier.id === 'gold' || tier.id === 'holo') && <GoldTrim size="lg" />}
      {tier.id === 'silver' && (
        <span className="mint-glint" aria-hidden="true" />
      )}
      <PushPin color="#ff6b57" lean={16} size={34} className="mint-pin" />
      <div className="mint-photo">
        <div
          className="mint-art"
          style={{ translate: `${off}px ${off * 0.6}px` }}
        >
          <DrawingImage imageUrl={s.imageUrl} alt="" draggable={false} />
        </div>
        <Wear card={card} />
        {marks.length > 0 && (
          <span className="mint-mark">{marks.join(' · ')}</span>
        )}
        {tier.id === 'misprint' && <span className="mint-stamp">MISPRINT</span>}
      </div>
      <div className="mint-chin">
        <div className="mint-l1">
          <span className="mint-name">{s.prompt}</span>
          <span className="mint-type">
            {tier.name} {tier.pips}
          </span>
        </div>
        <div className="mint-l2">
          <UserProfileIcon user={s.user} size="xs" showLevel={false} />
          <span className="mint-by">
            drawn by <b>{s.user.username}</b> · {formatDay(card.day)}
            <span>
              No. {card.serial} · {card.set}
            </span>
          </span>
          <LogoIcon theme={null} size={20} />
          <span className="mint-vtag">v{card.ver}</span>
        </div>
      </div>
      <div className="mint-score">
        <b>{formatScore(s.score)}</b>
        <small>/10</small>
      </div>
      <div className="mint-sheen" />
    </div>
  );
};

const Back: FC<{ card: MintCard; pop: PopNumbers }> = ({ card, pop }) => {
  const { source: s, tier, signature } = card;
  return (
    <div className={cn('mint-face mint-back', `mint-t-${tier.id}`)}>
      {(tier.id === 'gold' || tier.id === 'silver') && (
        <span className="mint-glint" aria-hidden="true" />
      )}
      <div className="mint-bk">
        <div className="mint-bk-head">
          <span
            className="mint-lockup"
            role="img"
            aria-label="The Daily Doodle"
          >
            <LogoIcon theme={null} size={24} />
            <span>
              <small>the daily</small>
              <b>Doodle</b>
            </span>
          </span>
          <span className="mint-vtag">v{card.ver}</span>
        </div>
        <div className="mint-hero">
          <span className="mint-kicker">
            No. {card.serial} · {card.set} · {tier.name}
          </span>
          <span className="mint-title">{s.prompt}</span>
          <span className="mint-hand">
            drawn by {s.user.username}, {formatDay(card.day)}
          </span>
        </div>
        <div className="mint-stats">
          <div>
            <b>
              {formatScore(s.score)}
              <small>/10</small>
            </b>
            <span>score</span>
          </div>
          <div>
            <b>{card.cond.overall}</b>
            <span>{GRADE_NAMES[card.cond.overall]}</span>
          </div>
          <div>
            <b style={{ color: tier.accent }}>
              1/{compactOdds(card.rarity.odds)}
            </b>
            <span>{card.rarity.rank}</span>
          </div>
        </div>
        <div className="mint-pop">
          <span className="mint-live">
            <i />
            live
          </span>
          <span>
            <b>{pop.both}</b> of <b>{pop.tier}</b> {tier.name} cards share this
            grade · <b>{pop.higher}</b> graded higher
          </span>
        </div>
        {s.comment && <p className="mint-note">“{s.comment}”</p>}
        <div
          className="mint-sign"
          style={
            {
              '--sig-font': signature.font,
              '--sig-ink': signature.ink,
              '--sig-scale': signature.scale,
            } as CSSProperties
          }
        >
          <AIJudgeAvatar judge={s.judge} size="lg" />
          <div className="mint-sig">
            <span className="mint-label">reviewed &amp; signed</span>
            <span className="mint-ink">{signature.text}</span>
            <span className="mint-line">
              <span>{s.judge.name}</span>
              <span>{s.model}</span>
            </span>
          </div>
        </div>
        <div className="mint-foot">
          <span>preview · not signed yet</span>
          <span>
            format {card.fmt} · v{card.ver}
          </span>
        </div>
      </div>
    </div>
  );
};

type Props = {
  card: MintCard;
  pop: PopNumbers;
  /** Widest it gets, in px; it shrinks to fit narrow screens */
  width?: number;
  className?: string;
};

/**
 * A minted polaroid in 3D: drag to turn it, tap or press Enter to flip it
 * over. The back is signed by the judge who reviewed it.
 */
export const MintedPolaroid3D: FC<Props> = ({
  card,
  pop,
  width = 330,
  className,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const rotation = useRef({ rx: -6, ry: -18 });
  const drag = useRef<{
    x: number;
    y: number;
    rx: number;
    ry: number;
    moved: number;
  } | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Rotation lives in CSS variables, so dragging never re-renders the card
  const apply = () => {
    const { rx, ry } = rotation.current;
    const rad = (ry * Math.PI) / 180;
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--rx', String(rx));
    el.style.setProperty('--ry', String(ry));
    el.style.setProperty(
      '--mx',
      (50 + Math.sin(rad) * 45 + rx * 0.6).toFixed(1),
    );
    el.style.setProperty('--my', (50 - rx * 1.2).toFixed(1));
    floorRef.current?.style.setProperty(
      '--sx',
      Math.max(0.12, Math.abs(Math.cos(rad))).toFixed(2),
    );
  };
  useLayoutEffect(apply);

  const snapTo = (rx: number, ry: number) => {
    setSnapping(true);
    rotation.current = { rx, ry };
    apply();
    window.setTimeout(() => setSnapping(false), 720);
  };
  const flip = () =>
    snapTo(0, Math.round(rotation.current.ry / 180) * 180 + 180);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      ...rotation.current,
      moved: 0,
    };
    setSnapping(false);
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
    rotation.current = {
      ry: d.ry + dx * 0.55,
      rx: Math.max(-40, Math.min(40, d.rx - dy * 0.35)),
    };
    apply();
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    // A tap flips it; a drag settles on whichever face is nearer
    const nearest = Math.round(rotation.current.ry / 180) * 180;
    snapTo(0, d.moved < 6 ? nearest + 180 : nearest);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flip();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      snapTo(
        rotation.current.rx,
        rotation.current.ry + (e.key === 'ArrowLeft' ? -30 : 30),
      );
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${card.source.user.username}'s ${card.tier.name} polaroid, scored ${formatScore(card.source.score)}. Drag to turn it, or press Enter to flip it over.`}
      className={cn('mint-stage', dragging && 'mint-dragging', className)}
      style={{ '--mw': `${width}px` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <div className="mint-float">
        <div ref={cardRef} className={cn('mint-card', snapping && 'mint-snap')}>
          <Front card={card} />
          <Back card={card} pop={pop} />
        </div>
      </div>
      <div ref={floorRef} className="mint-floor" aria-hidden="true" />
    </div>
  );
};
