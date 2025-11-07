// ==========================================
// NEW FILE
// client/src/utils/useDebounce.js
// ==========================================

import { useState, useEffect } from 'react';

/**
 * A custom hook to debounce a value.
 * This prevents rapid, excessive updates (e.g., API calls on every keystroke).
 * @param {*} value The value to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns The debounced value, which only updates after the delay.
 */
function useDebounce(value, delay) {
  // State to hold the debounced value
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // This is the cleanup function:
    // It clears the timeout if the 'value' changes before the delay is over.
    // This is what resets the timer on every new keystroke.
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Only re-run the effect if the value or delay changes

  return debouncedValue;
}

export default useDebounce;