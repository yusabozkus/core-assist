import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/server-auth"
import { APP_ROUTES } from "@/constants/site"

export const dynamic = "force-dynamic"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect(APP_ROUTES.login)
  }

  return <>{children}</>
}
