import { Loader } from "lucide-react";

export function Pending() {
  return (
    <div className="mail-atmosphere animate-in fade-in flex h-screen w-full flex-1 items-center justify-center duration-300">
      <span className="mail-inset flex size-14 items-center justify-center rounded-[13px] border text-[var(--mail-brass)]">
        <Loader className="size-5 animate-spin" />
      </span>
    </div>
  );
}
