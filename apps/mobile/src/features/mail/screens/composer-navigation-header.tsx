import { ComposerHeader } from "./composer-header";
import { ComposerTabHeader } from "./composer-tab-header";

export function ComposerNavigationHeader({
  canSend,
  onCancel,
  onDismissKeyboard,
  onSend,
  variant,
}: {
  canSend: boolean;
  onCancel: () => void;
  onDismissKeyboard: () => void;
  onSend: () => void;
  variant: "modal" | "tab";
}) {
  if (variant === "tab") {
    return (
      <ComposerTabHeader
        canSend={canSend}
        onDismissKeyboard={onDismissKeyboard}
        onSend={onSend}
      />
    );
  }
  return (
    <ComposerHeader canSend={canSend} onCancel={onCancel} onSend={onSend} />
  );
}
