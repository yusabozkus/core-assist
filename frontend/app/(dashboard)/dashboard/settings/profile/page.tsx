import { redirect } from "next/navigation"

import { ProfileForm } from "./profile-form"
import { Badge } from "@/components/ui/badge"
import { APP_ROUTES } from "@/constants/site"
import { getServerAccountOverview } from "@/lib/api/users.server"
import { getCurrentUser } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

type ProfilePageProps = {
  searchParams: Promise<{
    linked?: string
    error?: string
  }>
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect(APP_ROUTES.login)
  }

  const [overview, params] = await Promise.all([
    getServerAccountOverview(),
    searchParams,
  ])

  return (
    <main className="mx-auto w-full max-w-[1120px] space-y-7 px-5 py-8 sm:px-8 lg:px-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">
            Hesap ve güvenlik
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Profilinizi, giriş yöntemlerinizi, açık oturumlarınızı ve hesap
            verilerinizi tek yerden yönetin.
          </p>
        </div>
        <Badge
          variant="outline"
          className="w-fit bg-card font-medium text-muted-foreground"
        >
          {formatMembershipDate(overview.createdAt)} tarihinden beri üye
        </Badge>
      </header>

      <ProfileForm
        user={currentUser.user}
        overview={overview}
        linkedProvider={params.linked}
        linkError={params.error}
      />
    </main>
  )
}

function formatMembershipDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}
