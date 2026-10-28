/**
 * Adapted from shadcn/ui (https://github.com/shadcn-ui/ui)
 * Revision: 481d523374745e77d0cf9c53a4115ab5dd7c8481
 * Source: apps/v4/registry/new-york-v4/ui/native-select.tsx
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
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";

function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
  return (
    <div
      className={["ui-native-select-wrapper", className].filter(Boolean).join(" ")}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="ui-native-select"
        {...props}
      />
      <CaretDown
        size={14}
        className="ui-native-select-icon"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={className}
      {...props}
    />
  );
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={className}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
