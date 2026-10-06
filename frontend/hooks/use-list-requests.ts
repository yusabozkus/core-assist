"use client"

import { useLayoutEffect, useState } from "react"
import { ListRequests } from "@/lib/list-requests"

export function useListRequests(key: string, initialKey: string) {
  const [requests] = useState(() => new ListRequests(initialKey))
  // Invalidate before passive effects, debounce timers or observers can run.
  useLayoutEffect(() => {
    requests.activate(key)
    return () => requests.dispose()
  }, [key, requests])
  return requests
}
