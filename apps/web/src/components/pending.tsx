import { Loader } from "lucide-react";

export function Pending() {
  return (
    <div className="animate-in fade-in flex h-screen w-full flex-1 items-center justify-center duration-1000">
      <Loader className="size-6 animate-spin" />
    </div>
  );
}
