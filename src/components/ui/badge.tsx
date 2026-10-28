/**
 * Adapted from shadcn/ui (https://github.com/shadcn-ui/ui)
 * Revision: 481d523374745e77d0cf9c53a4115ab5dd7c8481
 * Source: apps/v4/registry/new-york-v4/ui/badge.tsx
 *
 * MIT License
 * Copyright (c) 2023 shadcn
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import * as React from "react";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "persimmon"
  | "brass"
  | "success"
  | "danger";

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={["ui-badge", `ui-badge--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export { Badge };
