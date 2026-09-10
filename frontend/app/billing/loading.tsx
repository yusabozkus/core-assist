import { Skeleton } from "@/components/ui/skeleton"

export default function BillingLoading() {
  return (
    <div
      role="status"
      aria-label="Faturalandırma bilgileri yükleniyor"
      className="mx-auto w-full max-w-[1120px] space-y-6 px-5 py-12 sm:px-8"
    >
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}
