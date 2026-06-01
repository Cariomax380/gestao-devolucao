import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPct(value: number | null, decimals = 1): string {
  if (value === null || isNaN(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

export function formatHL(value: number | null, decimals = 2): string {
  if (value === null || isNaN(value)) return '—'
  return `${value.toFixed(decimals)} HL`
}

export function formatTime(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
