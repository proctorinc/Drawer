import { PUPIL_SIZE } from './googly';
import { stickerHeight } from './stickers';
import type { Pupil } from './googly';
import type { PlacedSticker } from './stickers';

const INK = '#2b2a33';
const PLACEHOLDER = '#a3a1ab';
/** The font a bubble's words are written in (the app's accent font) */
export const BUBBLE_FONT = 'Gaegu';

type PaintOptions = {
  /** Where each googly eye's pupil is; resting at the bottom if not given */
  pupils?: Array<Pupil>;
  /** Shown in an empty word bubble while it's still being edited */
  placeholder?: string;
};

/** The outline's thickness: a touch heavier on a bigger sticker */
const lineWidth = (width: number) => Math.min(3.5, Math.max(1.5, width * 0.02));

/**
 * Splits text into lines no wider than maxWidth, breaking a word too long for
 * one line wherever it has to.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): Array<string> {
  const lines: Array<string> = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const joined = line ? `${line} ${word}` : word;
    if (measure(joined) <= maxWidth) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const char of word) {
      if (line && measure(line + char) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The biggest the words can be written and still fit in the bubble */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
) {
  for (let size = maxHeight * 0.5; size > 4; size -= 0.5) {
    ctx.font = `700 ${size}px ${BUBBLE_FONT}`;
    const lines = wrapText(text, maxWidth, (t) => ctx.measureText(t).width);
    if (lines.length * size * 0.95 <= maxHeight) return { size, lines };
  }
  ctx.font = `700 4px ${BUBBLE_FONT}`;
  return {
    size: 4,
    lines: wrapText(text, maxWidth, (t) => ctx.measureText(t).width),
  };
}

function paintBubble(
  ctx: CanvasRenderingContext2D,
  { width: w, flipped, text }: PlacedSticker,
  h: number,
  placeholder: string | undefined,
) {
  const lw = lineWidth(w);
  // The tail hangs from the body's bottom
  const bodyH = h * 0.8;
  const body = new Path2D();
  body.ellipse(w / 2, bodyH / 2, w / 2 - lw, bodyH / 2 - lw, 0, 0, Math.PI * 2);
  // Its base tucks inside the body, so the fill hides where they join
  const tail = new Path2D();
  tail.moveTo(w * 0.22, bodyH * 0.72);
  tail.quadraticCurveTo(w * 0.2, bodyH * 0.95, w * 0.08, h - lw);
  tail.quadraticCurveTo(w * 0.27, bodyH * 0.98, w * 0.4, bodyH * 0.86);
  tail.closePath();

  ctx.save();
  if (flipped) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  // Stroked twice as thick and then filled, so only the outer half shows and
  // the two shapes read as one outline
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw * 2;
  ctx.strokeStyle = INK;
  ctx.stroke(tail);
  ctx.stroke(body);
  ctx.fillStyle = 'white';
  ctx.fill(tail);
  ctx.fill(body);
  ctx.restore();

  const words = text.trim() || placeholder;
  if (!words) return;
  // The roomy middle of the oval
  const { size, lines } = fitText(ctx, words, w * 0.72, bodyH * 0.62);
  ctx.fillStyle = text.trim() ? INK : PLACEHOLDER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = size * 0.95;
  const top = bodyH / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, top + i * lineHeight);
  });
}

/** The middle of each googly eye and how big it is, in the sticker's own space */
export function eyesOf(w: number, h: number) {
  const radius = h / 2 - lineWidth(w);
  return {
    radius,
    centers: [
      { x: h / 2, y: h / 2 },
      { x: w - h / 2, y: h / 2 },
    ],
  };
}

function paintGooglyEyes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pupils: Array<Pupil> | undefined,
) {
  const lw = lineWidth(w);
  const { radius: r, centers } = eyesOf(w, h);
  centers.forEach((center, i) => {
    const pupil = pupils?.[i] ?? { x: 0, y: 1 - PUPIL_SIZE - 0.04 };
    ctx.save();
    ctx.translate(center.x, center.y);

    // The clear plastic dome over a white card, a little grey at the edge
    const dome = ctx.createRadialGradient(
      -r * 0.2,
      -r * 0.25,
      r * 0.1,
      0,
      0,
      r,
    );
    dome.addColorStop(0, '#ffffff');
    dome.addColorStop(0.75, '#f6f5f9');
    dome.addColorStop(1, '#dddbe4');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = dome;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pupil.x * r, pupil.y * r, r * PUPIL_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = '#18171d';
    ctx.fill();

    // The glint on the dome, on top of whatever the pupil's doing
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  });
}

/**
 * Paints a sticker where it sits on the page. The context draws in drawing
 * units, so this serves both the sticker on screen and the pinned picture.
 */
export function paintSticker(
  ctx: CanvasRenderingContext2D,
  sticker: PlacedSticker,
  { pupils, placeholder }: PaintOptions = {},
) {
  const h = stickerHeight(sticker);
  ctx.save();
  ctx.translate(sticker.x, sticker.y);
  if (sticker.kind === 'bubble') {
    paintBubble(ctx, sticker, h, placeholder);
  } else {
    paintGooglyEyes(ctx, sticker.width, h, pupils);
  }
  ctx.restore();
}

/** Waits for the bubble's font, so words never go out in a stand-in */
export async function loadStickerFonts() {
  try {
    await document.fonts.load(`700 20px ${BUBBLE_FONT}`);
  } catch {
    // No font loading API (or it failed): the fallback font will do
  }
}
