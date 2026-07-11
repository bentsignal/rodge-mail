import { useEffect, useState } from "react";

export function useDebouncedInput<T>(options: {
  timeInMs?: number;
  initialValue: T;
}) {
  const [value, setValue] = useState<T>(options.initialValue);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const time = options.timeInMs ?? 500;

  // eslint-disable-next-line no-restricted-syntax -- Debouncing needs a timer tied to value changes.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, time);
    return () => clearTimeout(timeout);
  }, [value, time]);

  function setValueImmediately(nextValue: T) {
    setValue(nextValue);
    setDebouncedValue(nextValue);
  }

  return { value, setValue, debouncedValue, setValueImmediately };
}
