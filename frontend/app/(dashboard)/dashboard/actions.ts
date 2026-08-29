"use server"

import { cookies } from "next/headers"

import {
  ACTIVE_STORE_COOKIE,
  getActiveStoreContext,
} from "@/lib/stores/active-store"

const ACTIVE_STORE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export async function selectActiveStore(storeId: string) {
  const { stores } = await getActiveStoreContext()

  if (!stores.some((store) => store.id === storeId)) {
    throw new Error("Bu mağazaya erişiminiz bulunmuyor.")
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    maxAge: ACTIVE_STORE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}
