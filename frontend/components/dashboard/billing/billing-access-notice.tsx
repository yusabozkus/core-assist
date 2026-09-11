import Link from "next/link"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"

export function BillingAccessNotice({
  unavailable = false,
}: {
  unavailable?: boolean
}) {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-medium text-muted-foreground">
          Plan ve faturalama
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {unavailable
            ? "Finans yetkisi doğrulanamadı"
            : "Finans yetkisi gerekiyor"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {unavailable
            ? "Yetkinizi şu anda kontrol edemiyoruz. Lütfen daha sonra tekrar deneyin."
            : "Faturaları görüntülemek ve aboneliği yönetmek için hesap sahibinden finans yetkisi almalısınız. Mağaza yöneticiliği bu yetkiyi kapsamaz."}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={APP_ROUTES.dashboard.settings.billing}>
            Aboneliğe dön
          </Link>
        </Button>
      </div>
    </section>
  )
}
