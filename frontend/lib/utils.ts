import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return "CA"
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR")

  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toLocaleUpperCase("tr-TR")
}

export function isPathActive(
  pathname: string,
  targetPath: string,
  exact = false
) {
  if (exact) return pathname === targetPath

  return pathname === targetPath || pathname.startsWith(`${targetPath}/`)
}
