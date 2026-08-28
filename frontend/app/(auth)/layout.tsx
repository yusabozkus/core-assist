import React from "react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Layers01Icon,
  ShieldCheckIcon,
  Clock01Icon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="flex w-full lg:w-1/2 flex-col justify-between pt-10 pb-8 px-8 sm:px-12 lg:px-14 xl:px-20 bg-background min-h-screen">
        <div className="flex items-center justify-between w-full">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-foreground transition-opacity hover:opacity-85"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-mono text-xs font-bold shadow-md shadow-primary/25">
              CA
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base tracking-tight font-bold">CoreAssist</span>
              <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                v1.0
              </span>
            </div>
          </Link>

          <ThemeToggle />
        </div>

        <div className="mx-auto my-auto w-full max-w-sm py-8 sm:py-10">
          {children}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground pt-6 border-t border-border/80 w-full">
          <span>&copy; {new Date().getFullYear()} CoreAssist Inc.</span>
          <div className="flex items-center gap-4">
            <Link href="#" className="hover:text-foreground transition-colors">
              Gizlilik
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Kullanım Şartları
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Destek
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between pt-10 pb-8 px-12 xl:px-16 2xl:px-20 bg-[#080C1A] text-slate-100 border-l border-border relative overflow-hidden bg-indigo-grid min-h-screen">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[550px] rounded-full bg-indigo-600/[0.07] blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 size-[550px] rounded-full bg-violet-600/[0.06] blur-[140px]" />

        <div className="flex items-center justify-between z-10 w-full">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Canlı Senkronizasyon Aktif</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium border border-slate-800/80 bg-slate-900/60 px-2.5 py-1 rounded-lg">
            <HugeiconsIcon icon={Layers01Icon} className="size-3.5 text-indigo-400" />
            <span>Çoklu Mağaza Yönetimi</span>
          </div>
        </div>

        <div className="my-auto max-w-xl space-y-7 z-10 py-6">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Çok Kanallı E-Ticaret Operasyon Masası
            </div>

            <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-[1.18]">
              Tüm satış ve iletişim kanallarınız tek bir merkezde.
            </h2>

            <p className="text-sm xl:text-base text-slate-300/90 leading-relaxed max-w-lg">
              Trendyol, Hepsiburada, WhatsApp ve Instagram kanallarınızdaki müşteri taleplerini, sipariş takiplerini ve anlık stok durumunu tek ekrandan yönetin.
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-500/20 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-2xl shadow-indigo-950/40">
            <div className="flex items-center justify-between border-b border-slate-800/90 px-4 py-3 bg-slate-950/50">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="bg-indigo-600 text-white font-medium px-2.5 py-1 rounded-md text-[11px]">
                  Tümü (34)
                </span>
                <span className="text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer">
                  Trendyol (18)
                </span>
                <span className="text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer">
                  WhatsApp (11)
                </span>
                <span className="text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer">
                  Hepsiburada (5)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">CANLI AKIŞ</span>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs">
              <div className="flex items-center justify-between p-3.5 hover:bg-slate-800/25 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 font-bold text-[10px] border border-orange-500/20">
                    TY
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">
                      Ahmet K. • Siyah XL Beden Sorusu
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Oversize Basic Tişört (#4819)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-medium">
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-3" />
                    Stok: 4 Adet
                  </span>
                  <span className="text-[10px] text-slate-400">Az önce</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 hover:bg-slate-800/25 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                    WA
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">
                      Selin T. • Sipariş Kargo Sorgusu
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Takip No: #TY-98214 / Teslimatta
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[11px] font-medium">
                    Kargoda
                  </span>
                  <span className="text-[10px] text-slate-400">2 dk</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 hover:bg-slate-800/25 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-[10px] border border-indigo-500/20">
                    HB
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">
                      Burak M. • Değişim Talebi
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Sneaker #42 Numara Değişimi
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  <span className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[11px] font-medium">
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
                <span className="font-semibold text-emerald-400">%100 Gerçek</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 z-10 w-full border-t border-slate-800/80 pt-6">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ShieldCheckIcon} className="size-4 text-emerald-400" />
            <span>Çok kiracılı (Multi-Tenant) güvenli mağaza ve veri izolasyonu.</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
            <span>7/24 Kesintisiz</span>
          </div>
        </div>
      </div>
    </div>
  )
}
