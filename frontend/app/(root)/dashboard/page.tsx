import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { DashboardClient } from "./dashboard-client"
import { APP_ROUTES } from "@/constants/site"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001"
  let workspaces = []
  
  try {
    const res = await fetch(`${baseUrl}/workspaces`, {
      headers: {
        Cookie: allCookies
      }
    })
    
    if (res.ok) {
      workspaces = await res.json()
      if (workspaces.length === 0) {
        redirect(APP_ROUTES.onboarding)
      }
    }
  } catch (error) {
    console.error("Failed to fetch workspaces:", error)
  }

  return <DashboardClient workspaces={workspaces} />
}
