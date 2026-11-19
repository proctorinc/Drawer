/**
 * How every polaroid's frame is drawn: on the wall, on a doodle's page, in
 * the hall of fame and in the pinning animation. Flat, like the rest of the
 * UI's drawings: a white print with an ink outline and no shadow of any
 * kind, so nothing reads as 3D.
 */

/** A polaroid at wall size or smaller */
export const polaroidFrameClass = 'bg-white border-2 border-ink';

/** The big one on a doodle's own page */
export const bigPolaroidFrameClass = 'bg-white border-2 border-ink';

/** The pinning animation's frame once it's a polaroid */
export const polaroidFrameStyle = {
  borderWidth: 2,
  borderColor: 'var(--color-ink)',
  boxShadow: 'none',
} as const;
