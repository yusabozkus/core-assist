export const questionStatusTones = {
  deliveryReview:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  failed: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  deliveryPending:
    "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  draft:
    "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  blocked:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  outOfScope:
    "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  shadowEligible:
    "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  review:
    "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  ready: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-400",
  pending: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  answered:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  neutral: "border-border bg-muted text-muted-foreground",
} as const
