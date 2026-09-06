import { notFound } from "next/navigation"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getDashboardNavigationTitle } from "@/constants/site"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export default async function DashboardPlaceholderPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  await getOperationalStoreContext()

  const { slug } = await params
  const pathname = `/dashboard/${slug.join("/")}`
  const title = getDashboardNavigationTitle(pathname)

  if (!title) {
    notFound()
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1440px] items-center px-5 py-12 sm:px-8 lg:px-10">
      <section className="w-full rounded-2xl border border-border bg-card p-7 shadow-xs sm:p-10">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HugeiconsIcon icon={InformationCircleIcon} className="size-5" />
        </span>
        <p className="mt-7 text-xs font-semibold tracking-[0.12em] text-primary uppercase">
          Planlanan modül
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Bu bölüm ürün yol haritasında yer alıyor. Sidebar yönlendirmesi hazır;
          işlevsel ekran bir sonraki geliştirme aşamasında eklenecek.
        </p>
      </section>
    </div>
  )
}
