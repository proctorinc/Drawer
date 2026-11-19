import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, FC } from 'react';
import type { User } from '@/api/Api';
import { PushPin } from '@/components/PushPin';
import { CommentIcon, StarIcon } from '@/components/icons';
import {
  cornerButtonClass,
  pillClass,
} from '@/pages/feed/components/PinButton';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { polaroidFrameStyle } from '@/components/polaroid';
import { cn } from '@/utils';

// How long each beat takes, in ms
const FADE_UI = 280;
const BECOME_POLAROID = 720;
const PIN_DROP = 620;
const SWING = 1900;
const SETTLE = 350;

// The wall's polaroid, which this one copies at a larger scale: a ~140px
// photo in an 8px white border (p-2), with the pin 32px and its needle ~6px in
const WALL_PHOTO = 140;
const WALL_BORDER = 8;
const WALL_PIN = 32;
const WALL_PIN_DEPTH = 6;
// Your polaroid leads the wall, where the first pin leans this way
const PIN_LEAN = 20;
// PushPin's needle tip, in its 40×40 viewBox
const PIN_TIP = { x: 20, y: 36 };
// Space kept between the polaroid and the screen's sides, and how much of
// the screen's width it takes once it's set down on the board
const SIDE_MARGIN = 24;
const BOARD_SHARE = 0.74;
// The wall's caption strip: pt-2, a row with a 36px avatar, pb-2
const WALL_CAPTION = 52;
// Your polaroid leads the wall, which tilts its first card this much
const WALL_TILT = -2;
// Little ink strokes that flick out where the pin goes in, as angles
const BURST = [205, 245, 295, 335];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Props = {
  /** The finished drawing */
  imageUrl: string;
  /** Where the canvas sits on screen, from getBoundingClientRect */
  from: DOMRect;
  pinColor: string;
  /** Whose drawing it is, shown under the photo as on the wall */
  user: User;
  onDone: () => void;
};

/**
 * Pinning a drawing to the wall: the canvas becomes a polaroid, just like the
 * one it'll be on the wall, a pin drops in and presses home, and the polaroid
 * swings on it before settling. Lays itself over the canvas, so render it
 * with the canvas's position.
 */
export const PinCeremony: FC<Props> = ({
  imageUrl,
  from,
  pinColor,
  user,
  onDone,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const swingRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const joltRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [isPolaroid, setIsPolaroid] = useState(false);
  // `from` is in viewport terms; a transformed ancestor moves our origin
  const [origin, setOrigin] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    const box = rootRef.current?.getBoundingClientRect();
    setOrigin({
      x: box?.left ?? 0,
      y: box?.top ?? 0,
      width: box?.width ?? window.innerWidth,
    });
  }, []);

  // The canvas, in our own coordinates
  const x = from.left - (origin?.x ?? 0);
  const y = from.top - (origin?.y ?? 0);
  const w = from.width;
  const h = from.height;
  // Set down on the board, the polaroid shrinks to a share of the screen;
  // everything else is the wall's polaroid scaled up to match it
  const screenWidth = origin?.width ?? Infinity;
  const target = Math.min(
    screenWidth - 2 * SIDE_MARGIN,
    screenWidth * BOARD_SHARE,
  );
  const fit = Math.min(1, target / (w * (1 + (2 * WALL_BORDER) / WALL_PHOTO)));
  const photoW = isPolaroid ? w * fit : w;
  const photoH = isPolaroid ? h * fit : h;
  const scale = (w * fit) / WALL_PHOTO;
  const border = WALL_BORDER * scale;
  const pinSize = WALL_PIN * scale;
  // Where the needle goes in, relative to the frame's top-left
  const pinX = border + photoW / 2;
  const pinY = WALL_PIN_DEPTH * scale;
  const polaroidHeight = photoH + border + WALL_CAPTION * scale;
  const burstSize = pinSize * 1.8;

  useEffect(() => {
    if (!origin) return;
    // An object, so checks after each await see the cleanup's change
    const state = { cancelled: false };
    const isCancelled = () => state.cancelled;
    const running: Array<Animation> = [];
    const play = (
      el: HTMLElement | null,
      keyframes: Array<Keyframe>,
      options: KeyframeAnimationOptions,
    ) => {
      if (!el) return null;
      const animation = el.animate(keyframes, { fill: 'forwards', ...options });
      running.push(animation);
      return animation;
    };

    async function run() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setIsPolaroid(true);
        pinRef.current?.style.setProperty('opacity', '1');
        await wait(900);
        if (!isCancelled()) doneRef.current();
        return;
      }

      // The drawing tools fade out around the canvas
      await wait(FADE_UI);
      if (isCancelled()) return;
      // Picked up, it rises a touch, then is set down on the board
      setIsPolaroid(true);
      play(
        liftRef.current,
        [
          { transform: 'scale(1) translateY(0px)', easing: 'ease-out' },
          {
            offset: 0.4,
            transform: 'scale(1.05) translateY(-8px)',
            easing: 'ease-in',
          },
          {
            offset: 0.78,
            transform: 'scale(0.985) translateY(1px)',
            easing: 'ease-out',
          },
          { transform: 'scale(1) translateY(0px)' },
        ],
        { duration: BECOME_POLAROID + 120 },
      );
      play(
        joltRef.current,
        [
          {
            boxShadow:
              '3px 4px 0 -1px var(--color-paper), 3px 4px 0 1px var(--color-ink)',
          },
          // Flat from here on: the canvas's pencil shadow simply goes
          { boxShadow: polaroidFrameStyle.boxShadow },
        ],
        { duration: BECOME_POLAROID + 120, easing: 'ease-in-out' },
      );
      await wait(BECOME_POLAROID + 120);
      if (isCancelled()) return;

      // The pin drops in from above, hovers a beat, then pushes home
      const drop = play(
        pinRef.current,
        [
          {
            offset: 0,
            transform: `translateY(${-90 * scale}px) scale(1.35)`,
            opacity: 0,
            easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
          },
          {
            offset: 0.55,
            transform: `translateY(${-10 * scale}px) scale(1.12)`,
            opacity: 1,
            easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)',
          },
          { offset: 1, transform: 'translateY(0px) scale(1)', opacity: 1 },
        ],
        { duration: PIN_DROP },
      );
      await drop?.finished;
      if (isCancelled()) return;

      // Tack! The pin squashes, ink flicks out and phones give a tiny buzz
      // Not every browser has vibrate (iOS Safari doesn't), whatever the types say
      if ('vibrate' in navigator) navigator.vibrate(12);
      play(
        pinRef.current,
        [
          { transform: 'scale(1, 1)' },
          { transform: 'scale(1.08, 0.84)' },
          { transform: 'scale(1, 1)' },
        ],
        { duration: 200, easing: 'ease-out' },
      );
      play(
        burstRef.current,
        [
          { opacity: 0, transform: 'scale(0.45)' },
          { offset: 0.25, opacity: 1 },
          { opacity: 0, transform: 'scale(1.25)' },
        ],
        { duration: 420, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      );

      // The push nudges the polaroid, then it swings on its new pin and
      // settles at the tilt it has on the wall
      play(
        joltRef.current,
        [
          { transform: 'translateY(0px)' },
          { transform: `translateY(${2 * scale}px)` },
          { transform: 'translateY(0px)' },
        ],
        { duration: 220, easing: 'ease-out', fill: 'none' },
      );
      const swing = play(
        swingRef.current,
        [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(5.5deg)' },
          { transform: 'rotate(-6.5deg)' },
          { transform: 'rotate(1.2deg)' },
          { transform: 'rotate(-4deg)' },
          { transform: 'rotate(-0.6deg)' },
          { transform: `rotate(${WALL_TILT}deg)` },
        ],
        { duration: SWING, easing: 'ease-in-out' },
      );

      await swing?.finished;
      await wait(SETTLE);
      if (!isCancelled()) doneRef.current();
    }

    run().catch(() => {
      // Cancelled animations reject; leaving is fine
    });
    return () => {
      state.cancelled = true;
      running.forEach((animation) => animation.cancel());
    };
  }, [origin, scale]);

  const spring = 'var(--ease-spring)';
  // A hard-edged polaroid keeps an ink outline around its frame
  const edge = polaroidFrameStyle.borderWidth;
  const morph = (property: string) =>
    `${property} ${BECOME_POLAROID}ms ${spring}`;
  const frameStyle: CSSProperties = isPolaroid
    ? {
        // Set down centered on where the canvas was
        left: x + (w - photoW) / 2 - border - edge,
        top: y + (h - polaroidHeight) / 2 - edge,
        padding: `${border}px ${border}px 0`,
        borderRadius: 0,
        // The wall's polaroid frame, scaled
        ...polaroidFrameStyle,
      }
    : {
        // Matches the canvas's own ink border and pencil shadow exactly
        left: x - 2,
        top: y - 2,
        padding: 0,
        borderWidth: 2,
        borderColor: 'var(--color-ink)',
        borderRadius: '6px 14px 8px 12px / 12px 6px 14px 8px',
        boxShadow:
          '3px 4px 0 -1px var(--color-paper), 3px 4px 0 1px var(--color-ink)',
      };

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 z-50 pointer-events-none"
    >
      {origin && (
        <div
          ref={swingRef}
          className="absolute"
          style={{
            left: frameStyle.left,
            top: frameStyle.top,
            transformOrigin: `${pinX}px ${pinY}px`,
            transition: `${morph('left')}, ${morph('top')}`,
          }}
        >
          <div ref={liftRef} style={{ transformOrigin: '50% 50%' }}>
            <div
              ref={joltRef}
              className="relative bg-white border-solid"
              style={{
                ...frameStyle,
                left: undefined,
                top: undefined,
                transition: [
                  'padding',
                  'border-width',
                  'border-color',
                  'border-radius',
                ]
                  .map(morph)
                  .join(', '),
              }}
            >
              <img
                src={imageUrl}
                alt=""
                className="block"
                style={{
                  width: photoW,
                  height: photoH,
                  transition: `${morph('width')}, ${morph('height')}`,
                }}
              />
              {/* The caption strip slides open. Inside is the wall's caption at
                its real size, zoomed up to this polaroid's scale */}
              <div
                className="grid"
                style={{
                  gridTemplateRows: isPolaroid ? '1fr' : '0fr',
                  transition: morph('grid-template-rows'),
                }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    className="flex items-center gap-2 pt-2 pb-2"
                    style={{ zoom: scale }}
                  >
                    <UserProfileIcon
                      user={user}
                      size="sm"
                      className="flex-none"
                    />
                    <span className={cn(pillClass, 'ml-auto bg-white')}>
                      <CommentIcon size={14} strokeWidth={2.2} />
                    </span>
                  </div>
                </div>
              </div>
              {/* The star on the photo's corner, as on the wall */}
              <div
                className="absolute"
                style={{
                  top: border,
                  right: border,
                  zoom: scale,
                  opacity: isPolaroid ? 1 : 0,
                  transition: morph('opacity'),
                }}
              >
                <span className={cn(cornerButtonClass, 'bg-white')}>
                  <StarIcon size={16} strokeWidth={2.2} />
                </span>
              </div>
              {/* Ink that flicks out where the pin goes in */}
              <div
                ref={burstRef}
                className="absolute"
                style={{
                  left: pinX - burstSize / 2,
                  top: pinY - burstSize / 2,
                  width: burstSize,
                  height: burstSize,
                  opacity: 0,
                }}
              >
                <svg
                  viewBox="-50 -50 100 100"
                  width={burstSize}
                  height={burstSize}
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth="5"
                  strokeLinecap="round"
                >
                  <circle r="16" strokeWidth="3.5" opacity="0.35" />
                  {BURST.map((degrees) => {
                    const r = (degrees * Math.PI) / 180;
                    return (
                      <line
                        key={degrees}
                        x1={Math.cos(r) * 26}
                        y1={Math.sin(r) * 26}
                        x2={Math.cos(r) * 44}
                        y2={Math.sin(r) * 44}
                      />
                    );
                  })}
                </svg>
              </div>
              {/* Drops in from above, then stays with the polaroid */}
              <div
                ref={pinRef}
                className="absolute"
                style={{
                  left: pinX,
                  top: pinY,
                  width: 0,
                  height: 0,
                  opacity: 0,
                  transformOrigin: '0 0',
                }}
              >
                <PushPin
                  color={pinColor}
                  lean={PIN_LEAN}
                  size={pinSize}
                  className="absolute"
                  // Puts the needle tip on this box's origin
                  style={{
                    left: -(PIN_TIP.x * pinSize) / 40,
                    top: -(PIN_TIP.y * pinSize) / 40,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
