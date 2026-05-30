/**
 * Shared custom React hooks for FinFlow.
 * Import from here instead of defining inline in each view.
 */
import { useState, useEffect } from 'react';

/**
 * Debounces a value — only updates after `delay` ms of no changes.
 * Prevents expensive filter/search operations on every keystroke.
 *
 * @param {any} value - The value to debounce
 * @param {number} delay - Milliseconds to wait (typically 200–400)
 * @returns {any} The debounced value
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/**
 * Tracks the current window inner width and updates on resize.
 * Use to conditionally render mobile vs. desktop layouts.
 *
 * @returns {number} Current window.innerWidth
 */
export function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}
