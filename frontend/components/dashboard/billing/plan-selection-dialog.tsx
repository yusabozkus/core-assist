import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  BILLING_PREVIEW,
  BILLING_TRIAL,
  INCLUDED_MARKETPLACES,
} from "@/constants/billing"
import { getPlanPrice } from "@/lib/billing"
import type { BillingCycle, SubscriptionPlan } from "@/types/billing"

export function PlanSelectionDialog({
  plan,
  billingCycle,
  onOpenChange,
}: {
  plan: SubscriptionPlan | null
  billingCycle: BillingCycle
  onOpenChange: (open: boolean) => void
}) {
  const price = plan ? getPlanPrice(plan, billingCycle) : null
  return (
    <ResponsiveDialog
      open={plan !== null}
      onOpenChange={onOpenChange}
      title="Plan seçiminiz"
      description="Seçtiğiniz planın ücretini ve kullanım haklarını inceleyin."
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={close}>
            Kapat
          </Button>
          <Button type="button" size="sm" disabled>
            Plan değişikliği yakında
          </Button>
        </>
      )}
    >
      {plan && price && (
        <div className="space-y-6 py-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xl font-semibold tracking-tight">
                {plan.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {billingCycle === "annual"
                  ? "Yıllık abonelik"
                  : "Aylık abonelik"}
              </p>
            </div>
            <p className="text-lg font-semibold tabular-nums">
              {price.monthly}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                / ay
              </span>
            </p>
          </div>
          <dl className="space-y-4 border-y border-border py-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Mevcut plan</dt>
              <dd>{BILLING_PREVIEW.plan.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Aylık soru hakkı</dt>
              <dd>{plan.questions.toLocaleString("tr-TR")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Mağaza / kullanıcı</dt>
              <dd>
                {plan.stores} / {plan.members}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Pazaryerleri</dt>
              <dd className="text-right">{INCLUDED_MARKETPLACES}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {billingCycle === "annual" ? "Yıllık toplam" : "Aylık toplam"}
              </dt>
              <dd className="font-semibold">{price.total}</dd>
            </div>
            {billingCycle === "annual" && (
              <div className="flex justify-between gap-3 text-primary">
                <dt>Yıllık tasarruf</dt>
                <dd className="font-medium">{price.saving}</dd>
              </div>
            )}
          </dl>
          <p className="text-xs leading-6 text-muted-foreground">
            İlk aboneliğinizde kart bilgisi vermeden {BILLING_TRIAL.days} gün
            ücretsiz deneyebilirsiniz. Vergiler ödeme adresinize göre ödeme
            adımında hesaplanır. Bu ekran önizlemedir; planınız değiştirilmez ve
            ödeme alınmaz.
          </p>
        </div>
      )}
    </ResponsiveDialog>
  )
}
