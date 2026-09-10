export function billingRoutes(workspaceId: string) {
  const root = `/billing/${encodeURIComponent(workspaceId)}`
  return {
    overview: root,
    plans: `${root}/plans`,
    invoices: `${root}/invoices`,
  }
}
