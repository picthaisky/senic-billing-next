/**
 * Triggers haptic feedback on mobile devices if supported.
 * Perfect for button taps, list item clicks, or pull-to-refresh snaps.
 */
export const hapticImpact = (ms = 50) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ms);
  }
};
