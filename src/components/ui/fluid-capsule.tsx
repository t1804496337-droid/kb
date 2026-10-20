"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Neumorph #2 — fluid capsule morph on hover/active */
export function FluidCapsule({
  className,
  active,
  children,
  ...props
}: React.ComponentProps<"span"> & { active?: boolean }) {
  return (
    <span
      className={cn("fluid-capsule", active && "fluid-capsule-active", className)}
      {...props}
    >
      {children}
    </span>
  );
}
