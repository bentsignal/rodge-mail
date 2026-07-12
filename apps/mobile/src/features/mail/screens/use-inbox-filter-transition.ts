import { useEffect, useEffectEvent, useState } from "react";
import { Animated } from "react-native";

interface FilterSnapshot<T> {
  data: T[];
  showUnreadOnly: boolean;
}

export function useInboxFilterTransition<T>(
  data: T[],
  showUnreadOnly: boolean,
) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [rendered, setRendered] = useState<FilterSnapshot<T>>({
    data,
    showUnreadOnly,
  });

  const transitionToLatestFilter = useEffectEvent(() => {
    opacity.stopAnimation();
    Animated.timing(opacity, {
      duration: 90,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setRendered({ data, showUnreadOnly });
      Animated.timing(opacity, {
        duration: 140,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });
  });

  // eslint-disable-next-line no-restricted-syntax -- The previous filter stays mounted until its native fade-out completes.
  useEffect(() => {
    if (rendered.showUnreadOnly === showUnreadOnly) return;
    transitionToLatestFilter();
  }, [rendered.showUnreadOnly, showUnreadOnly]);

  const isCurrentFilter = rendered.showUnreadOnly === showUnreadOnly;
  return {
    data: isCurrentFilter ? data : rendered.data,
    opacity,
    showUnreadOnly: isCurrentFilter ? showUnreadOnly : rendered.showUnreadOnly,
  };
}
