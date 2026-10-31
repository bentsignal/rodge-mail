import { House } from "lucide-react";

import { Button } from "@rodge-mail/ui-web/button";

import { QuickLink } from "~/components/quick-link";

export function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-3xl font-semibold">Sorry about that</h1>
      <p className="text-muted-foreground">
        We couldn't find the page you're looking for.
      </p>
      <Button asChild className="mail-primary-button mt-3 rounded-[9px]">
        <QuickLink to="/">
          <House className="size-4" />
          Back to home
        </QuickLink>
      </Button>
    </div>
  );
}
