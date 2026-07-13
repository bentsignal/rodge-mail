import { useEffect, useEffectEvent, useState } from "react";
import { Animated } from "react-native";

interface FilterSnapshot<T, TFilter> {
  data: T[];
  filter: TFilter;
}

export function useInboxFilterTransition<T, TFilter extends string>(
  data: T[],
  filter: TFilter,
) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [rendered, setRendered] = useState<FilterSnapshot<T, TFilter>>({
    data,
    filter,
  });

  const transitionToLatestFilter = useEffectEvent(() => {
    opacity.stopAnimation();
    Animated.timing(opacity, {
      duration: 90,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setRendered({ data, filter });
      Animated.timing(opacity, {
        duration: 140,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });
  });

  // eslint-disable-next-line no-restricted-syntax -- The previous filter stays mounted until its native fade-out completes.
  useEffect(() => {
    if (rendered.filter === filter) return;
    transitionToLatestFilter();
  }, [filter, rendered.filter]);

  const isCurrentFilter = rendered.filter === filter;
  return {
    data: isCurrentFilter ? data : rendered.data,
    filter: isCurrentFilter ? filter : rendered.filter,
    opacity,
  };
}
