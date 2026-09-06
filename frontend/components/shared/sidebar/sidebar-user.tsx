"use client"
import { useState } from "react"
import Link from "next/link"
import {
  ArrowUpDownIcon,
  ComputerIcon,
  CreditCardIcon,
  CustomerSupportIcon,
  Logout01Icon,
  Moon02Icon,
  Notification01Icon,
  PaintBoardIcon,
  Sun03Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { APP_ROUTES } from "@/constants/site"
import { signOutCurrentUser } from "@/lib/auth-client"
import { getInitials } from "@/lib/utils"
import { useTheme } from "next-themes"

export type SidebarUserData = {
  name: string
  email: string
  avatarUrl?: string | null
}

export function SidebarUser({ user }: { user: SidebarUserData }) {
  const { theme, setTheme } = useTheme()
  const { isMobile } = useSidebar()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const initials = getInitials(user.name)

  async function handleSignOut() {
    if (isSigningOut) return

    setIsSigningOut(true)
    setSignOutError(null)

    try {
      await signOutCurrentUser()

      window.location.replace(APP_ROUTES.login)
    } catch {
      setSignOutError("Çıkış yapılamadı. Lütfen tekrar deneyin.")
      setIsSigningOut(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar user={user} initials={initials} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user.email}
                </span>
              </div>
              <HugeiconsIcon
                icon={ArrowUpDownIcon}
                className="ml-auto size-4"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) overflow-visible! backdrop-blur-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <UserAvatar user={user} initials={initials} />
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={APP_ROUTES.dashboard.settings.profile}>
                  <HugeiconsIcon icon={UserCircleIcon} />
                  Hesap bilgileri
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={APP_ROUTES.dashboard.support}>
                  <HugeiconsIcon icon={CustomerSupportIcon} />
                  Yardım Merkezi
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={APP_ROUTES.dashboard.settings.notifications}>
                  <HugeiconsIcon icon={Notification01Icon} />
                  Bildirimler
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={APP_ROUTES.dashboard.settings.billing}>
                  <HugeiconsIcon icon={CreditCardIcon} />
                  Plan ve faturalama
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <HugeiconsIcon icon={PaintBoardIcon} />
                  Görünüm
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="backdrop-blur-xl">
                  <DropdownMenuRadioGroup
                    value={theme ?? "system"}
                    onValueChange={setTheme}
                  >
                    <DropdownMenuRadioItem value="light">
                      <HugeiconsIcon icon={Sun03Icon} />
                      Açık
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <HugeiconsIcon icon={Moon02Icon} />
                      Koyu
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <HugeiconsIcon icon={ComputerIcon} />
                      Sistem
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isSigningOut}
              onSelect={() => void handleSignOut()}
            >
              <HugeiconsIcon icon={Logout01Icon} />
              {isSigningOut ? "Çıkış yapılıyor..." : "Çıkış yap"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {signOutError ? (
          <p className="px-2 pt-1 text-xs text-destructive" role="alert">
            {signOutError}
          </p>
        ) : null}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UserAvatar({
  user,
  initials,
}: {
  user: SidebarUserData
  initials: string
}) {
  return (
    <Avatar className="size-8">
      {user.avatarUrl ? (
        <AvatarImage src={user.avatarUrl} alt={user.name} />
      ) : null}
      <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
