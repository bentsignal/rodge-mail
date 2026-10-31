import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

import { cn } from "@rodge-mail/std/cn";

function Container(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Root>,
) {
  return <ContextMenuPrimitive.Root {...props} />;
}

function Trigger(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>,
) {
  return <ContextMenuPrimitive.Trigger {...props} />;
}

function Content({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          "bg-popover text-popover-foreground z-50 min-w-48 overflow-hidden rounded-xl border p-1.5 shadow-lg outline-none",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function Item({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item>) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs outline-none select-none",
        className,
      )}
      {...props}
    />
  );
}

function Separator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("bg-border mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export { Container, Content, Item, Separator, Trigger };
