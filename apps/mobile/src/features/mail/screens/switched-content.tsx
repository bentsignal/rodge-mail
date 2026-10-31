import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { View } from "react-native";

import type { MessageViewMode } from "./thread-message-body";

const SEGMENT_ANIMATION_MS = 350;
const ORIGINAL_READY_FALLBACK_MS = 1_500;

type OriginalStage = "unmounted" | "loading" | "ready";

// The original mounts hidden once it is first chosen and shows when it has
// laid out. After that both views stay mounted, one behind the other, so
// switching never creates or tears down a web view.
export function SwitchedContent({
  clean,
  renderOriginal,
  viewMode,
}: {
  clean: ReactNode;
  renderOriginal: (onReady: () => void) => ReactNode;
  viewMode: MessageViewMode;
}) {
  const [stage, setStage] = useState<OriginalStage>("unmounted");
  // eslint-disable-next-line no-restricted-syntax -- Creating a web view blocks the UI thread, so it waits until the segmented control has finished animating, and shows anyway if it never reports its layout.
  useEffect(() => {
    if (viewMode !== "original" || stage === "ready") return;
    const timer = setTimeout(
      () => setStage(stage === "unmounted" ? "loading" : "ready"),
      stage === "unmounted" ? SEGMENT_ANIMATION_MS : ORIGINAL_READY_FALLBACK_MS,
    );
    return () => clearTimeout(timer);
  }, [stage, viewMode]);
  const showsOriginal = viewMode === "original" && stage === "ready";
  return (
    <View>
      <ContentLayer isActive={!showsOriginal}>{clean}</ContentLayer>
      <OriginalLayer isActive={showsOriginal} stage={stage}>
        {renderOriginal(() => setStage("ready"))}
      </OriginalLayer>
    </View>
  );
}

function OriginalLayer({
  children,
  isActive,
  stage,
}: {
  children: ReactNode;
  isActive: boolean;
  stage: OriginalStage;
}) {
  if (stage === "unmounted") return null;
  return <ContentLayer isActive={isActive}>{children}</ContentLayer>;
}

function ContentLayer({
  children,
  isActive,
}: {
  children: ReactNode;
  isActive: boolean;
}) {
  return (
    <View
      aria-hidden={!isActive}
      collapsable={false}
      className={
        isActive ? "" : "pointer-events-none absolute inset-x-0 top-0 opacity-0"
      }
    >
      {children}
    </View>
  );
}
