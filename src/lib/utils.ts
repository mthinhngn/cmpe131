import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Prefix matches Tailwind v4 and components.json. Legacy workspace CSS is separate.
const merge = extendTailwindMerge({ prefix: "cr" });

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
