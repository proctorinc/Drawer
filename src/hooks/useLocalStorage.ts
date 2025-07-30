import { useEffect, useState } from 'react';

export default function useLocalStorage<T>(
  key: string,
  initialValue: T,
  delayMS: number = 1000,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Use useState to manage the internal state of the hook.
  // The initial state is determined by checking localStorage first.
  const [value, setValue] = useState<T>(() => {
    try {
      // Get the stored item from localStorage
      const storedValue = window.localStorage.getItem(key);

      if (storedValue === null) {
        // If nothing is stored, return the initialValue
        return initialValue;
      }

      // Attempt to parse the stored value.
      // If it's an object or array, it was likely stringified JSON.
      // Otherwise, treat it as a primitive type.
      if (
        (typeof initialValue === 'object' && initialValue !== null) ||
        Array.isArray(initialValue)
      ) {
        return JSON.parse(storedValue) as T;
      } else if (typeof initialValue === 'number') {
        const num = parseFloat(storedValue);
        return (isNaN(num) ? initialValue : num) as T;
      } else if (typeof initialValue === 'boolean') {
        return (storedValue === 'true') as T;
      }
      // For string and other primitives, return as is.
      return storedValue as T;
    } catch (error) {
      // If there's an error (e.g., localStorage not available, malformed JSON),
      // log the error and return the initial value.
      console.error(
        `useLocalStorage: Error reading from localStorage for key "${key}":`,
        error,
      );
      return initialValue;
    }
  });

  // useEffect hook to synchronize state changes with localStorage.
  // This runs whenever the 'value' state or 'key' prop changes.
  useEffect(() => {
    // If a delay is specified, set up a timeout to debounce the save operation.
    if (delayMS > 0) {
      const handler = setTimeout(() => {
        try {
          let valueToStore: string;
          // Determine how to store the value based on its type.
          // Objects and arrays need to be stringified.
          if (
            (typeof value === 'object' && value !== null) ||
            Array.isArray(value)
          ) {
            valueToStore = JSON.stringify(value);
          } else {
            // Primitives can be converted directly to string.
            valueToStore = String(value);
          }
          window.localStorage.setItem(key, valueToStore);
        } catch (error) {
          // Log any errors during the localStorage write operation
          console.error(
            `useLocalStorage: Error writing to localStorage for key "${key}":`,
            error,
          );
        }
      }, delayMS);

      // Cleanup function: Clear the timeout if the component unmounts or
      // if 'value' or 'key' changes before the delay is over.
      return () => {
        clearTimeout(handler);
      };
    } else {
      // If no delay (or delay is 0), save immediately.
      try {
        let valueToStore: string;
        if (
          (typeof value === 'object' && value !== null) ||
          Array.isArray(value)
        ) {
          valueToStore = JSON.stringify(value);
        } else {
          valueToStore = String(value);
        }
        window.localStorage.setItem(key, valueToStore);
      } catch (error) {
        console.error(
          `useLocalStorage: Error writing to localStorage for key "${key}":`,
          error,
        );
      }
    }
  }, [key, value, delayMS]); // Dependencies: re-run if key, value, or delay changes.

  return [value, setValue];
}
