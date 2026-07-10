import { useState } from "react";

interface RunOptions<T> {
  fn: () => Promise<T>;
  onError?: (error: unknown) => void;
}

export function useLoading() {
  const [isLoading, setIsLoading] = useState(false);

  function run<T>({ fn, onError }: RunOptions<T>) {
    setIsLoading(true);
    return Promise.resolve()
      .then(fn)
      .then(
        (result) => {
          setIsLoading(false);
          return result;
        },
        (error: unknown) => {
          setIsLoading(false);
          onError?.(error);
        },
      );
  }

  return { isLoading, run };
}
