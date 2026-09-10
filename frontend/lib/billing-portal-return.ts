const PORTAL_RETURN_PREFIX = "coreassist:billing-portal-return:"

export function markBillingPortalVisit(workspaceId: string) {
  window.sessionStorage.setItem(`${PORTAL_RETURN_PREFIX}${workspaceId}`, "1")
}

export function hasPendingBillingPortalReturn(workspaceId: string) {
  return (
    window.sessionStorage.getItem(`${PORTAL_RETURN_PREFIX}${workspaceId}`) ===
    "1"
  )
}

export function clearBillingPortalReturn(workspaceId: string) {
  window.sessionStorage.removeItem(`${PORTAL_RETURN_PREFIX}${workspaceId}`)
}
