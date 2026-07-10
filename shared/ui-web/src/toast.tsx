import type { ToasterProps } from "sonner";
import { Toaster as Sonner, toast } from "sonner";

type ToasterStyle = React.CSSProperties & {
  "--normal-bg": string;
  "--normal-text": string;
  "--normal-border": string;
};

// eslint-disable-next-line no-restricted-syntax -- CSS custom properties need an explicit React style type.
const toasterStyle: ToasterStyle = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
};

export function Toaster({ ...props }: ToasterProps) {
  return <Sonner className="toaster group" style={toasterStyle} {...props} />;
}

export { toast };
