import type { ReactNode } from "react";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const CONTENT_REVEAL_MS = 180;

/**
 * Shows the bare background until `isReady`, then fades its content in on
 * the UI thread. Content that is ready when it mounts shows at once, and
 * later updates (new rows, the next page) never fade.
 */
export function ContentReveal({
  children,
  isReady,
}: {
  children: ReactNode;
  isReady: boolean;
}) {
  const opacity = useSharedValue(isReady ? 1 : 0);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  // eslint-disable-next-line no-restricted-syntax -- The fade starts when the content is ready, a prop that comes from data arriving and the list's first layout.
  useEffect(() => {
    if (!isReady) opacity.set(0);
    else if (opacity.get() < 1) {
      opacity.set(withTiming(1, { duration: CONTENT_REVEAL_MS }));
    }
  }, [isReady, opacity]);

  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}
