export const triggerHaptic = (pattern = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Haptic vibration failed:', e);
    }
  }
};

export const haptics = {
  light: () => triggerHaptic(15),
  medium: () => triggerHaptic(30),
  heavy: () => triggerHaptic(60),
  success: () => triggerHaptic([40, 30, 40]),
  error: () => triggerHaptic([50, 40, 50, 40, 80]),
};
