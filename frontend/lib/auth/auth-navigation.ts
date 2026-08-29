import { APP_ROUTES } from "@/constants/site"

let isRedirectingToLogin = false

export function redirectToLoginAfterUnauthorized() {
  if (typeof window === "undefined" || isRedirectingToLogin) {
    return
  }

  if (window.location.pathname === APP_ROUTES.login) {
    return
  }

  isRedirectingToLogin = true

  const loginUrl = new URL(APP_ROUTES.login, window.location.origin)
  const returnTo = `${window.location.pathname}${window.location.search}`

  loginUrl.searchParams.set("reason", "session_expired")
  loginUrl.searchParams.set("returnTo", returnTo)

  window.location.replace(`${loginUrl.pathname}${loginUrl.search}`)
}
