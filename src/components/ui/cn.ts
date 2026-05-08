import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — concatena clases Tailwind, resuelve conflictos por especificidad
 * de Tailwind (gana la última). Wrapper estándar shadcn-style.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
