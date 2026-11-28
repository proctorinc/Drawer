// The tips open on their own the first time you sit down to draw, per device
const SEEN_KEY = 'drawing-tips-seen';

export const wereTipsSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    // Blocked storage: don't pop up every visit
    return true;
  }
};

export const markTipsSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode or blocked storage: nothing to remember it in
  }
};
