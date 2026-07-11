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
        "focus-within:ring-ring/40 flex cursor-pointer gap-2.5 rounded-[10px] border p-3 transition-colors focus-within:ring-[3px]",
        checked
          ? "mail-raised border-[var(--mail-brass)]"
          : "border-[var(--mail-seam)] bg-[var(--mail-paper)] shadow-[var(--mail-shadow-inset)]",
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
      <span className="mail-inset mt-0.5 size-4 shrink-0 rounded border" />
    );
  }
  return (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-[var(--mail-brass-deep)] bg-[var(--mail-brass)] text-[#21190a] shadow-[var(--mail-shadow-raised)]">
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
        "h-9 rounded-[8px] text-xs font-semibold transition-colors",
        active
          ? "mail-raised text-foreground border"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
