import React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Layers01Icon,
  ShieldCheckIcon,
  Clock01Icon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons"
import { getCurrentUser } from "@/lib/auth/server-auth"
import { APP_ROUTES } from "@/constants/site"

export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const currentUser = await getCurrentUser()

  if (currentUser) {
    redirect(APP_ROUTES.dashboard)
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="flex min-h-screen w-full flex-col justify-between bg-background px-8 pt-10 pb-8 sm:px-12 lg:w-1/2 lg:px-14 xl:px-20">
        <div className="flex w-full items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-foreground transition-opacity hover:opacity-85"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary font-mono text-xs font-bold text-primary-foreground shadow-md shadow-primary/25">
              CA
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight">
                CoreAssist
              </span>
              <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                v1.0
              </span>
            </div>
          </Link>

          <ThemeToggle />
        </div>

        <div className="mx-auto my-auto w-full max-w-sm py-8 sm:py-10">
          {children}
        </div>

        <div className="flex w-full flex-col items-center justify-between gap-2 border-t border-border/80 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>&copy; {new Date().getFullYear()} CoreAssist Inc.</span>
          <div className="flex items-center gap-4">
            <Link href="#" className="transition-colors hover:text-foreground">
              Gizlilik
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              Kullanım Şartları
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              Destek
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-indigo-grid relative hidden min-h-screen flex-col justify-between overflow-hidden border-l border-border bg-[#080C1A] px-12 pt-10 pb-8 text-slate-100 lg:flex lg:w-1/2 xl:px-16 2xl:px-20">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[550px] rounded-full bg-indigo-600/[0.07] blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 size-[550px] rounded-full bg-violet-600/[0.06] blur-[140px]" />

        <div className="z-10 flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
            <span>Canlı Senkronizasyon Aktif</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800/80 bg-slate-900/60 px-2.5 py-1 text-xs font-medium text-slate-400">
            <HugeiconsIcon
              icon={Layers01Icon}
              className="size-3.5 text-indigo-400"
            />
            <span>Çoklu Mağaza Yönetimi</span>
          </div>
        </div>

        <div className="z-10 my-auto max-w-xl space-y-7 py-6">
          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">
              Çok Kanallı E-Ticaret Operasyon Masası
            </div>

            <h2 className="text-3xl leading-[1.18] font-bold tracking-tight text-white xl:text-4xl">
              Tüm satış ve iletişim kanallarınız tek bir merkezde.
            </h2>

            <p className="max-w-lg text-sm leading-relaxed text-slate-300/90 xl:text-base">
              Trendyol, Hepsiburada, WhatsApp ve Instagram kanallarınızdaki
              müşteri taleplerini, sipariş takiplerini ve anlık stok durumunu
              tek ekrandan yönetin.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-indigo-500/20 bg-slate-900/80 shadow-2xl shadow-indigo-950/40 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/90 bg-slate-950/50 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white">
                  Tümü (34)
                </span>
                <span className="cursor-pointer rounded-md px-2.5 py-1 text-[11px] text-slate-400 transition-colors hover:text-slate-200">
                  Trendyol (18)
                </span>
                <span className="cursor-pointer rounded-md px-2.5 py-1 text-[11px] text-slate-400 transition-colors hover:text-slate-200">
                  WhatsApp (11)
                </span>
                <span className="cursor-pointer rounded-md px-2.5 py-1 text-[11px] text-slate-400 transition-colors hover:text-slate-200">
                  Hepsiburada (5)
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                CANLI AKIŞ
              </span>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs">
              <div className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-800/25">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10 text-[10px] font-bold text-orange-400">
                    TY
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-200">
                      Ahmet K. • Siyah XL Beden Sorusu
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      Oversize Basic Tişört (#4819)
                    </div>
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    <HugeiconsIcon
                      icon={CheckmarkBadge01Icon}
                      className="size-3"
                    />
                    Stok: 4 Adet
                  </span>
                  <span className="text-[10px] text-slate-400">Az önce</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-800/25">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-bold text-emerald-400">
                    WA
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-200">
                      Selin T. • Sipariş Kargo Sorgusu
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      Takip No: #TY-98214 / Teslimatta
                    </div>
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                    Kargoda
                  </span>
                  <span className="text-[10px] text-slate-400">2 dk</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-800/25">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-[10px] font-bold text-indigo-400">
                    HB
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-200">
                      Burak M. • Değişim Talebi
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      Sneaker #42 Numara Değişimi
                    </div>
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
                    İşleme Alındı
                  </span>
                  <span className="text-[10px] text-slate-400">5 dk</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-800/80 bg-slate-950/60 p-2.5 text-center text-[11px]">
              <div>
                <span className="text-slate-400">Ortalama Yanıt:</span>{" "}
                <span className="font-semibold text-slate-200">45 sn</span>
              </div>
              <div>
                <span className="text-slate-400">Bugünkü Trafik:</span>{" "}
                <span className="font-semibold text-slate-200">142 Talep</span>
              </div>
              <div>
                <span className="text-slate-400">Doğruluk:</span>{" "}
                <span className="font-semibold text-emerald-400">
                  %100 Gerçek
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="z-10 flex w-full items-center justify-between border-t border-slate-800/80 pt-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={ShieldCheckIcon}
              className="size-4 text-emerald-400"
            />
            <span>
              Çok kiracılı (Multi-Tenant) güvenli mağaza ve veri izolasyonu.
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
            <span>7/24 Kesintisiz</span>
          </div>
        </div>
      </div>
    </div>
  )
}
