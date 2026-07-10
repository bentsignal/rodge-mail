import { House } from "lucide-react";

import { Button } from "@rodge-mail/ui-web/button";

import { QuickLink } from "~/components/quick-link";

export function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-bold">Sorry about that</h1>
      <p className="text-muted-foreground">
        We couldn't find the page you're looking for.
      </p>
      <Button asChild className="mt-1">
        <QuickLink to="/">
          <House className="size-4" />
          Back to home
        </QuickLink>
      </Button>
    </div>
  );
}
