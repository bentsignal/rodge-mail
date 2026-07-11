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
          "z-50 min-w-48 overflow-hidden rounded-xl border border-[#d8cec0] bg-[#fffdf8] p-1.5 text-[#292d28] shadow-[0_18px_48px_rgba(44,36,27,0.18)] outline-none dark:border-[#464b44] dark:bg-[#2c302b] dark:text-[#f4eee4]",
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
        "flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs outline-none select-none data-[highlighted]:bg-[#eee5d8] data-[highlighted]:text-[#20251f] dark:data-[highlighted]:bg-[#3a3f38] dark:data-[highlighted]:text-white",
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
      className={cn("mx-1 my-1 h-px bg-[#e3dace] dark:bg-[#424740]", className)}
      {...props}
    />
  );
}

export { Container, Content, Item, Separator, Trigger };
