import { useSyncExternalStore } from 'react';

/**
 * How loud the canvas sounds and how hard it buzzes, kept on this device.
 * The sound level also sets how loud the celebrations are (src/sound).
 * Each runs from 0 (none) to 4; 3 is how it always felt.
 */
export type FeedbackLevel = 0 | 1 | 2 | 3 | 4;
export type FeedbackKind = 'sound' | 'vibrate';
export type FeedbackSettings = Record<FeedbackKind, FeedbackLevel>;

export const FEEDBACK_LEVELS: ReadonlyArray<FeedbackLevel> = [0, 1, 2, 3, 4];
/** Where a toggle lands when it turns something back on */
export const MIDDLE_LEVEL: FeedbackLevel = 2;

const STORAGE_KEY = 'drawer:canvas-feedback';
const DEFAULTS: FeedbackSettings = { sound: 3, vibrate: 3 };

const isLevel = (value: unknown): value is FeedbackLevel =>
  typeof value === 'number' && FEEDBACK_LEVELS.includes(value as FeedbackLevel);

function load(): FeedbackSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<FeedbackKind, unknown>>;
    return {
      sound: isLevel(parsed.sound) ? parsed.sound : DEFAULTS.sound,
      vibrate: isLevel(parsed.vibrate) ? parsed.vibrate : DEFAULTS.vibrate,
    };
  } catch {
    return DEFAULTS;
  }
}

let settings: FeedbackSettings =
  typeof window === 'undefined' ? DEFAULTS : load();
const listeners = new Set<() => void>();

export const getFeedbackSettings = () => settings;

export function setFeedbackLevel(kind: FeedbackKind, level: FeedbackLevel) {
  if (settings[kind] === level) return;
  settings = { ...settings, [kind]: level };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or storage full: it still holds for this visit
  }
  listeners.forEach((listener) => listener());
}

/** Off goes to the middle; anything on goes off */
export function toggleFeedback(kind: FeedbackKind) {
  setFeedbackLevel(kind, settings[kind] === 0 ? MIDDLE_LEVEL : 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useFeedbackSettings = () =>
  useSyncExternalStore(subscribe, getFeedbackSettings, () => DEFAULTS);
