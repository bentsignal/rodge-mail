/** One line of the composer's header, like Mail's: a label and a hairline. */
export function ComposeRow({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="border-border ml-5 border-b-[0.5px] pr-5">
      <div className="flex min-h-11 items-center">{children}</div>
      <RowError error={error} />
    </div>
  );
}

function RowError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return (
    <p className="text-destructive -mt-1.5 pb-2 text-xs" role="alert">
      {error}
    </p>
  );
}
