import { describe, expect, it } from 'vitest';
import {
  getFeedbackSettings,
  setFeedbackLevel,
  toggleFeedback,
} from '../feedbackSettings';

describe('canvas feedback settings', () => {
  it('toggles on to off, and off to the middle level', () => {
    setFeedbackLevel('sound', 4);
    toggleFeedback('sound');
    expect(getFeedbackSettings().sound).toBe(0);
    toggleFeedback('sound');
    expect(getFeedbackSettings().sound).toBe(2);
  });

  it('keeps each setting on its own and remembers it', () => {
    setFeedbackLevel('vibrate', 1);
    setFeedbackLevel('sound', 3);
    expect(getFeedbackSettings()).toEqual({ sound: 3, vibrate: 1 });
    expect(
      JSON.parse(window.localStorage.getItem('drawer:canvas-feedback') ?? ''),
    ).toEqual({ sound: 3, vibrate: 1 });
  });
});
