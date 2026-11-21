/**
 * Every button, link and tab in the app clicks softly when pressed. One
 * listener on the window covers them all; anything with its own sound (the
 * canvas toolbar, say) opts out with `data-sound="off"` on itself or a parent.
 * Follows the sound level in the canvas settings, so muting there mutes this.
 */

import { uiClick } from '@/drawing/feedback';

const PRESSABLE = [
  'button',
  'a[href]',
  'summary',
  'label[for]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  'select',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(',');

function pressable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target.closest(PRESSABLE);
  if (!el) return false;
  if (el.closest('[data-sound="off"]')) return false;
  if (el.matches(':disabled, [aria-disabled="true"]')) return false;
  return true;
}

let lastClick = 0;
let lastPointer = '';

function play() {
  const now = performance.now();
  // A press and the click it turns into shouldn't both sound
  if (now - lastClick < 60) return;
  lastClick = now;
  uiClick();
}

let installed = false;

export function installButtonClicks() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Mouse and pen click on the way down, which feels most like a real button
  window.addEventListener(
    'pointerdown',
    (event) => {
      lastPointer = event.pointerType;
      if (!event.isTrusted || event.pointerType === 'touch') return;
      if (event.button !== 0) return;
      if (pressable(event.target)) play();
    },
    true,
  );

  // Fingers wait for the tap to land, so scrolling past a button stays quiet;
  // keyboard presses (Enter, Space) come through here too
  window.addEventListener(
    'click',
    (event) => {
      if (!event.isTrusted) return;
      const keyboard = event.detail === 0;
      if (!keyboard && lastPointer !== 'touch') return;
      if (pressable(event.target)) play();
    },
    true,
  );
}
