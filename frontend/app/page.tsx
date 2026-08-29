import { redirect } from "next/navigation"
import { APP_ROUTES } from "@/constants/site"

export default function HomePage() {
  redirect(APP_ROUTES.login)
}
