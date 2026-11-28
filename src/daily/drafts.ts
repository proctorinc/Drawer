/**
 * Unfinished daily doodles live on the device, one per prompt day. Today's is
 * the one on the desk; yesterday's is kept too, so a doodle the rollover
 * interrupted can still be finished (the server only allows that if it saw
 * the doodle started in time).
 */
const PREFIX = 'DRAWING_SUBMISSION_';

/** Where day's unfinished doodle is kept */
export const draftKey = (day: string | undefined) =>
  `${PREFIX}${day ? day.slice(0, 10) : 'pending'}`;

/** The prompt day before day, as "YYYY-MM-DD" */
export function dayBefore(day: string): string {
  const date = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Whether there's anything drawn for day on this device */
export function hasDraft(day: string): boolean {
  try {
    return localStorage.getItem(draftKey(day)) !== null;
  } catch {
    return false;
  }
}

/** Forgets day's doodle, once it's pinned */
export function clearDraft(day: string) {
  try {
    localStorage.removeItem(draftKey(day));
  } catch {
    // Storage blocked: there was nothing kept
  }
  clearStickerDraft(day);
}

/**
 * Drops every draft but today's and yesterday's: those can't be pinned any
 * more. A sticker goes with them, unless it's on a redo still being drawn.
 */
export function clearOldDrafts(today: string) {
  const keep = new Set([draftKey(today), draftKey(dayBefore(today))]);
  const keepSticker = (key: string) => {
    const day = key.slice(STICKER_PREFIX.length);
    return keep.has(draftKey(day)) || localStorage.getItem(redoDraftKey(day));
  };
  try {
    Object.keys(localStorage)
      .filter((key) =>
        key.startsWith(PREFIX)
          ? !keep.has(key)
          : key.startsWith(STICKER_PREFIX) && !keepSticker(key),
      )
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage blocked: nothing to tidy
  }
}

const STICKER_PREFIX = 'STICKER_';

/** Where the sticker on day's drawing is kept until it's pinned, for the daily, a late finish or a redo */
export const stickerDraftKey = (day: string) =>
  `${STICKER_PREFIX}${day.slice(0, 10)}`;

/** Forgets the sticker on day's drawing, once it's pinned */
export function clearStickerDraft(day: string) {
  try {
    localStorage.removeItem(stickerDraftKey(day));
  } catch {
    // Storage blocked: there was nothing kept
  }
}

const REDO_PREFIX = 'REDO_DRAWING_';

/**
 * Where a redo of day's prompt is kept while it's drawn. Apart from the daily
 * drafts, so the daily tidy-up leaves it be; it goes once it's pinned.
 */
export const redoDraftKey = (day: string) =>
  `${REDO_PREFIX}${day.slice(0, 10)}`;

/** Forgets a redo's drawing, once it's pinned */
export function clearRedoDraft(day: string) {
  try {
    localStorage.removeItem(redoDraftKey(day));
  } catch {
    // Storage blocked: there was nothing kept
  }
  clearStickerDraft(day);
}
