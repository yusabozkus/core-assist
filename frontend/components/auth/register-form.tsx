"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserAccountIcon,
  Mail01Icon,
  LockPasswordIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"

export function RegisterForm() {
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.acceptTerms) {
      alert("Lütfen kullanım koşullarını ve gizlilik politikasını kabul ediniz.")
      return
    }
    if (formData.password !== formData.confirmPassword) {
      alert("Şifreler eşleşmiyor.")
      return
    }
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
    }, 600)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="text-xs font-semibold text-primary tracking-wide uppercase">
          Hemen Başlayın
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Hesabınızı oluşturun
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tüm e-ticaret satış kanallarınızı dakikalar içinde bağlayın.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName" required>
            Ad Soyad
          </Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Ahmet Yılmaz"
            required
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
            icon={<HugeiconsIcon icon={UserAccountIcon} className="size-4" />}
          />
        </div>

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
          <Label htmlFor="password" required>
            Şifre
          </Label>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="En az 8 karakter"
            required
            minLength={8}
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
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
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

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" required>
            Şifre Tekrar
          </Label>
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Şifrenizi tekrar girin"
            required
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            icon={<HugeiconsIcon icon={LockPasswordIcon} className="size-4" />}
            endIcon={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-muted-foreground/70 hover:text-foreground transition-colors focus:outline-hidden"
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showConfirmPassword ? (
                  <HugeiconsIcon icon={EyeOffIcon} className="size-4" />
                ) : (
                  <HugeiconsIcon icon={EyeIcon} className="size-4" />
                )}
              </button>
            }
          />
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <Checkbox
            id="acceptTerms"
            checked={formData.acceptTerms}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, acceptTerms: checked })
            }
            className="mt-0.5"
          />
          <label
            htmlFor="acceptTerms"
            className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none"
          >
            <Link href="#" className="text-foreground underline underline-offset-2 hover:text-primary">
              Kullanım koşullarını
            </Link>{" "}
            ve{" "}
            <Link href="#" className="text-foreground underline underline-offset-2 hover:text-primary">
              gizlilik politikasını
            </Link>{" "}
            kabul ediyorum.
          </label>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="w-full mt-2 font-semibold text-sm rounded-2xl shadow-xs"
        >
          {isLoading ? "Hesap oluşturuluyor..." : "Hesap Oluştur"}
        </Button>

        <div className="text-center text-xs text-muted-foreground pt-1">
          Zaten bir hesabınız var mı?{" "}
          <Link
            href="/login"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-primary transition-colors"
          >
            Giriş Yapın
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-3 border-t border-border/40">
          <HugeiconsIcon icon={ShieldCheckIcon} className="size-3.5 text-muted-foreground" />
          <span>Güvenli kayıt. Verileriniz daima size aittir.</span>
        </div>
      </form>
    </div>
  )
}
