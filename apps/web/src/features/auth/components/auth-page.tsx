import type { ReactNode } from "react";

import { useAuthStore } from "../store";

export function AuthPage({ children }: { children: ReactNode }) {
  const imSignedIn = useAuthStore((store) => store.imSignedIn);
  if (imSignedIn) return null;

  return (
    <main className="bg-background relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <section className="relative z-10 w-full max-w-[360px] py-8">
        <div className="mb-9 flex flex-col items-center text-center">
          <img alt="" className="size-16 rounded-[14px]" src="/icon-192.png" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Rodge Mail
          </h1>
        </div>
        {children}
      </section>
    </main>
  );
}
