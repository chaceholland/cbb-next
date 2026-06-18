import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Local class-name combiner so `components/shared/` stays self-contained and
 * copy-portable (no import reaches outside this folder). Mirrors lib/utils.ts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
