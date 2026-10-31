import { Loader } from "lucide-react";

export function Pending() {
  return (
    <div className="animate-in fade-in flex h-screen w-full flex-1 items-center justify-center duration-300">
      <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-[13px] border">
        <Loader className="size-5 animate-spin" />
      </span>
    </div>
  );
}
