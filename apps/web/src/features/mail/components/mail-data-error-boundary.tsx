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
        <section className="mail-workspace w-full max-w-lg rounded-[18px] border p-8 text-center">
          <span className="mail-inset mx-auto flex size-14 items-center justify-center rounded-[13px] border text-[var(--mail-ink-soft)]">
            <CloudOff className="size-5" strokeWidth={1.5} />
          </span>
          <p className="mail-label mt-5 font-mono text-[9px] tracking-[0.18em] uppercase">
            Convex connection interrupted
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.035em]">
            The inbox could not be opened
          </h1>
          <p className="mail-label mt-3 text-sm leading-6">
            Your mail is still safe. Check the connection and try the live view
            again.
          </p>
          <button
            className="mail-brass-button mx-auto mt-6 flex h-10 items-center gap-2 rounded-[9px] px-4 text-sm font-bold transition"
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
