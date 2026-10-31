export interface ComposerNavigationHeaderProps {
  canSend: boolean;
  onAttachFiles: () => void;
  onAttachPhotos: () => void;
  onCancel: () => void;
  onSend: () => void;
  title: string;
  variant: "modal" | "tab";
}
