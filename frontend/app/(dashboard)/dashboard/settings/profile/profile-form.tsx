"use client"

import { AccountDataControls } from "@/components/dashboard/account/account-data-controls"
import { AccountProfile } from "@/components/dashboard/account/account-profile"
import { ActiveSessions } from "@/components/dashboard/account/active-sessions"
import { ConnectedAccounts } from "@/components/dashboard/account/connected-accounts"
import type { AccountOverview } from "@/types/user"

type ProfileFormProps = {
  user: {
    name: string
    email: string
    emailVerified: boolean
    image?: string | null
  }
  overview: AccountOverview
  linkedProvider?: string
  linkError?: string
}

export function ProfileForm({
  user,
  overview,
  linkedProvider,
  linkError,
}: ProfileFormProps) {
  return (
    <div className="space-y-6">
      <AccountProfile user={user} />
      <ConnectedAccounts
        initialAccounts={overview.accounts}
        initialLinkedProvider={linkedProvider}
        initialLinkError={linkError}
      />
      <ActiveSessions initialSessions={overview.sessions} />
      <AccountDataControls
        ownedStoreCount={overview.ownedStoreCount}
      />
    </div>
  )
}
