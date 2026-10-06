type ListRequestKind = "first" | "more" | "refresh"

export type ListRequest = {
  key: string
  kind: ListRequestKind
  controller: AbortController
  signal: AbortSignal
}

// One owner for the list, its cursor, counts, error and loading state. Abort
// alone is insufficient: a response may already have arrived when filters change.
export class ListRequests {
  private key: string
  private loadedKey: string
  private enabled = false
  private active: ListRequest | null = null

  constructor(initialKey: string) {
    this.key = initialKey
    this.loadedKey = initialKey
  }

  activate(key: string) {
    if (key !== this.key) this.cancel()
    this.key = key
    this.enabled = true
  }

  dispose() {
    this.enabled = false
    this.cancel()
  }

  isReady(key: string) {
    return this.enabled && this.key === key && this.loadedKey === key
  }

  begin(key: string, kind: ListRequestKind): ListRequest | null {
    if (!this.enabled || this.key !== key) return null
    if (kind !== "first" && !this.isReady(key)) return null
    if (this.active) {
      // A user requesting the next page takes priority over background polling.
      if (
        kind !== "first" &&
        !(kind === "more" && this.active.kind === "refresh")
      )
        return null
      this.cancel()
    }
    const controller = new AbortController()
    const request = { key, kind, controller, signal: controller.signal }
    this.active = request
    return request
  }

  isCurrent(request: ListRequest) {
    return (
      this.enabled &&
      this.key === request.key &&
      this.active === request &&
      !request.signal.aborted
    )
  }

  commit(request: ListRequest) {
    if (!this.isCurrent(request)) return false
    this.loadedKey = request.key
    return true
  }

  finish(request: ListRequest) {
    if (!this.isCurrent(request)) return false
    this.active = null
    return true
  }

  cancel(request?: ListRequest) {
    if (request && this.active !== request) return
    this.active?.controller.abort()
    this.active = null
  }
}
