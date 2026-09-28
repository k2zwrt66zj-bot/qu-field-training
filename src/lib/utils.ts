import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toNum = (v: unknown): number => (v == null ? 0 : Number(v));

export const fmt = (n: number, digits = 0) =>
  new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: digits }).format(n);
