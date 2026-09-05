import "server-only"

import { existsSync } from "node:fs"
import path from "node:path"

import { LANDING_SCREENSHOTS } from "@/constants/landing-screenshots"

export function getProductScreenshots() {
  // Share the same real app captures across public pages without requesting missing assets.
  return LANDING_SCREENSHOTS.map((screenshot) => ({
    ...screenshot,
    available: existsSync(
      path.join(process.cwd(), "public", screenshot.src.slice(1))
    ),
  }))
}
