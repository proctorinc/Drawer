import type { FriendSubmissionStatus, User } from '@/api/Api';

/**
 * Today's roll call, split by whether people have drawn. You lead your own
 * group, so you're always first among whichever side you're on
 */
export function rollCall(
  statuses: Array<FriendSubmissionStatus>,
  me: User,
  iDrew: boolean,
) {
  const mine: FriendSubmissionStatus = statuses.find(
    (status) => status.user.id === me.id,
  ) ?? { user: me, hasSubmittedToday: iDrew, pokedToday: false };
  const friends = statuses.filter((status) => status.user.id !== me.id);
  const drawn = friends.filter((friend) => friend.hasSubmittedToday);
  const stillDrawing = friends.filter((friend) => !friend.hasSubmittedToday);
  if (mine.hasSubmittedToday) drawn.unshift(mine);
  else stillDrawing.unshift(mine);
  return { drawn, stillDrawing, friendCount: friends.length };
}

/** Where each avatar sits, left edge and top, in px */
export type Spot = { x: number; y: number };

type RowLayout = {
  /** Positions for drawn then still-drawing, null for anyone left off */
  spots: Array<Spot | null>;
  height: number;
};

/**
 * One row: the drawn stack from the left, the rest stack from the right.
 * Whoever drew overlaps only as much as they need to fit; the still-drawing
 * matter less, so they're always stacked tight. Past the tightest overlap,
 * the people at the end of each group are left off
 */
export function collapsedLayout(
  drawn: number,
  stillDrawing: number,
  width: number,
  size: number,
): RowLayout {
  const loose = size + 6;
  // The still-drawing pile's step even when there's room to spare
  const compact = size * 0.5;
  const tightest = size * 0.35;
  const groupGap = drawn > 0 && stillDrawing > 0 ? size * 0.5 : 0;
  // Each group's first avatar is whole; everyone after it adds one step
  const groups = (drawn > 0 ? 1 : 0) + (stillDrawing > 0 ? 1 : 0);
  const room = width - groups * size - groupGap;

  let shownDrawn = drawn;
  let shownStill = stillDrawing;
  const stepsFor = () =>
    Math.max(shownDrawn - 1, 0) + Math.max(shownStill - 1, 0);
  const maxSteps = Math.max(Math.floor(room / tightest), 0);
  // Trim in proportion, so the row still shows which side is bigger, but
  // never down to nobody on a side
  while (stepsFor() > maxSteps) {
    const drawnShare = shownDrawn / drawn;
    const stillShare = shownStill / stillDrawing;
    if (shownStill <= 1 || (shownDrawn > 1 && drawnShare >= stillShare)) {
      shownDrawn--;
    } else {
      shownStill--;
    }
  }

  // An even step for everyone, if the row has to squeeze past compact
  const steps = stepsFor();
  const even = steps > 0 ? room / steps : loose;
  const stillSteps = Math.max(shownStill - 1, 0);
  const drawnSteps = Math.max(shownDrawn - 1, 0);
  const stillStep = Math.min(compact, even);
  // Whoever drew gets the room the compact pile leaves over
  const drawnStep =
    drawnSteps > 0
      ? Math.min(loose, (room - stillSteps * stillStep) / drawnSteps)
      : loose;
  const spots: Array<Spot | null> = [];
  for (let i = 0; i < drawn; i++) {
    spots.push(i < shownDrawn ? { x: i * drawnStep, y: 0 } : null);
  }
  for (let i = 0; i < stillDrawing; i++) {
    spots.push(
      i < shownStill ? { x: width - size - i * stillStep, y: 0 } : null,
    );
  }
  return { spots, height: size };
}

/** Everyone spread out on a grid across the full width: drawn on top, the rest below */
export function expandedLayout(
  drawn: number,
  stillDrawing: number,
  width: number,
  size: number,
): RowLayout {
  const gap = 10;
  const columns = Math.max(Math.floor((width + gap) / (size + gap)), 1);
  const cell = columns > 1 ? (width - size) / (columns - 1) : 0;
  const rowHeight = size + gap;
  const groupGap = 8;

  const spots: Array<Spot> = [];
  let top = 0;
  for (const count of [drawn, stillDrawing]) {
    if (count === 0) continue;
    if (spots.length > 0) top += groupGap;
    for (let i = 0; i < count; i++) {
      spots.push({
        x: (i % columns) * cell,
        y: top + Math.floor(i / columns) * rowHeight,
      });
    }
    top += Math.ceil(count / columns) * rowHeight;
  }
  return { spots, height: Math.max(top - gap, size) };
}
