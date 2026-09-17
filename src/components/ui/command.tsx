"use client"

import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

/** `shouldFilter` is forwarded so a caller can own its own ranking. cmdk's
 *  default scores a fuzzy subsequence across every field, which is too loose for
 *  a catalogue of full-sentence descriptions. */
const CommandDialog = ({ children, shouldFilter, ...props }: DialogProps & { shouldFilter?: boolean }) => {
  return (
    <Dialog {...props}>
      <DialogContent className="gap-0 overflow-hidden p-0 shadow-lg sm:max-w-2xl">
        <DialogTitle className="sr-only">Search ResearchTools</DialogTitle>
        <DialogDescription className="sr-only">Find and open tools, analysis frameworks, features, and pages.</DialogDescription>
        <Command shouldFilter={shouldFilter} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    className="flex items-center gap-3 border-b px-4 transition-colors focus-within:bg-accent/60 focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring/30"
    cmdk-input-wrapper=""
  >
    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-14 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      "max-h-[300px] scroll-py-2 overflow-y-auto overflow-x-hidden overscroll-contain",
      "[scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]",
      "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2",
      className
    )}
    {...props}
  />
))

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="px-6 py-12 text-center text-sm"
    {...props}
  />
))

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-2 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground/80",
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-start gap-3 rounded-md px-3 py-2.5 text-sm outline-none transition-colors",
      "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[selected=true]:ring-1 data-[selected=true]:ring-inset data-[selected=true]:ring-ring/25",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 data-[selected=true]:[&_svg]:text-current",
      className
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = "CommandShortcut"

/** Persistent footer for keyboard affordances and result counts. */
const CommandFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between gap-4 border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground",
      className
    )}
    {...props}
  />
)
CommandFooter.displayName = "CommandFooter"

/** A single key cap. Real element, themed from the palette, not a unicode glyph. */
const CommandKey = ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
  <kbd
    className={cn(
      "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-background px-1.5 font-sans text-[0.6875rem] font-medium text-foreground",
      className
    )}
    {...props}
  />
)
CommandKey.displayName = "CommandKey"

export {
  Command,
  CommandDialog,
  CommandFooter,
  CommandKey,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
