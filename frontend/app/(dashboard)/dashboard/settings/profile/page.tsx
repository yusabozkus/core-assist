import { redirect } from "next/navigation"

import { ProfileForm } from "./profile-form"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect(APP_ROUTES.login)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
          Hesap ayarları
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Profil bilgileri
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Oturumunuzda ve ekip alanlarında görünen kişisel bilgileri yönetin.
        </p>
      </div>

      <ProfileForm user={currentUser.user} />
    </div>
  )
}
