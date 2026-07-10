import { Component } from "react";
import { CloudOff, RotateCcw } from "lucide-react";

interface MailDataErrorBoundaryState {
  error?: Error;
}

export class MailDataErrorBoundary extends Component<
  { children: React.ReactNode },
  MailDataErrorBoundaryState
> {
  state: MailDataErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="mail-atmosphere bg-background text-foreground flex min-h-dvh items-center justify-center px-6">
        <section className="border-border/70 bg-card/92 w-full max-w-lg rounded-[24px] border p-8 text-center shadow-[0_24px_80px_rgba(48,38,24,0.10)] backdrop-blur-xl">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-dashed border-[#bfb4a5] text-[#978a7d]">
            <CloudOff className="size-5" strokeWidth={1.5} />
          </span>
          <p className="mt-5 font-mono text-[9px] tracking-[0.18em] text-[#8c8174] uppercase">
            Convex connection interrupted
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.035em]">
            The inbox could not be opened
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#81766a] dark:text-[#aaa095]">
            Your mail is still safe. Check the connection and try the live view
            again.
          </p>
          <button
            className="mx-auto mt-6 flex h-10 items-center gap-2 rounded-full bg-[#20251f] px-4 text-sm font-semibold text-[#f8f1e6] transition hover:-translate-y-0.5 hover:bg-[#30362f]"
            onClick={() => window.location.reload()}
            type="button"
          >
            <RotateCcw className="size-3.5" />
            Reload inbox
          </button>
        </section>
      </main>
    );
  }
}
