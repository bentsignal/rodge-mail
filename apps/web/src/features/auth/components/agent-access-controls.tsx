import { Check } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

export function ChoiceCard({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "focus-within:ring-ring/40 flex cursor-pointer gap-2.5 rounded-xl border p-3 transition-colors focus-within:ring-[3px]",
        checked
          ? "border-foreground/25 bg-background"
          : "border-border bg-background/35",
      )}
    >
      <input
        checked={checked}
        className="sr-only"
        onChange={onChange}
        type="checkbox"
      />
      <ChoiceMark checked={checked} />
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="text-muted-foreground mt-1 block text-[10px] leading-4">
          {description}
        </span>
      </span>
    </label>
  );
}

function ChoiceMark({ checked }: { checked: boolean }) {
  if (!checked) {
    return (
      <span className="border-input bg-background mt-0.5 size-4 shrink-0 rounded border" />
    );
  }
  return (
    <span className="bg-foreground text-background border-foreground mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border">
      <Check className="size-2.5" strokeWidth={3} />
    </span>
  );
}

export function SegmentButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "h-9 rounded-lg text-xs font-semibold transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
