"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Mail01Icon,
  LockPasswordIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"

export function LoginForm() {
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    email: "",
    password: "",
    rememberMe: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
    }, 600)
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <span className="text-xs font-semibold text-primary tracking-wide uppercase">
          CoreAssist&apos;e Hoş Geldiniz
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Çalışma alanınıza devam edin
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Mağazanızı, entegrasyonlarınızı ve müşteri mesajlarınızı tek panelden yönetin.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" required>
            E-posta
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="ornek@sirketiniz.com"
            required
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            icon={<HugeiconsIcon icon={Mail01Icon} className="size-4" />}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>
              Parola
            </Label>
            <Link
              href="#"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Şifremi unuttum
            </Link>
          </div>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            icon={<HugeiconsIcon icon={LockPasswordIcon} className="size-4" />}
            endIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground/70 hover:text-foreground transition-colors focus:outline-hidden"
                tabIndex={-1}
                aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
              >
                {showPassword ? (
                  <HugeiconsIcon icon={EyeOffIcon} className="size-4" />
                ) : (
                  <HugeiconsIcon icon={EyeIcon} className="size-4" />
                )}
              </button>
            }
          />
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <Checkbox
            id="rememberMe"
            checked={formData.rememberMe}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, rememberMe: checked })
            }
          />
          <label
            htmlFor="rememberMe"
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Beni hatırla
          </label>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="w-full mt-2 font-semibold text-sm rounded-2xl shadow-xs"
        >
          {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </Button>

        <div className="text-center text-xs text-muted-foreground pt-1">
          Hesabınız yok mu?{" "}
          <Link
            href="/register"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-primary transition-colors"
          >
            Kayıt Olun
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-4 border-t border-border/40">
          <HugeiconsIcon icon={ShieldCheckIcon} className="size-3.5 text-muted-foreground" />
          <span>Güvenli giriş. Verileriniz daima size aittir.</span>
        </div>
      </form>
    </div>
  )
}
