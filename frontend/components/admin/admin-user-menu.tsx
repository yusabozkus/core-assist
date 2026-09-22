"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowUpDownIcon,
  ComputerIcon,
  Logout01Icon,
  Moon02Icon,
  PaintBoardIcon,
  ShieldCheckIcon,
  Sun03Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type AdminUser = {
  name: string
  email: string
  avatarUrl?: string | null
}

export function AdminUserMenu({ user }: { user: AdminUser }) {
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
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  {user.name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  Sistem yöneticisi
                </span>
              </span>
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
            <DropdownMenuItem asChild className="p-0 font-normal">
              <Link
                href={APP_ROUTES.admin.account}
                className="flex items-center gap-2 px-2 py-2 text-left"
              >
                <UserAvatar user={user} initials={initials} />
                <div className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <HugeiconsIcon
                icon={ShieldCheckIcon}
                className="size-4 text-primary"
              />
              Admin erişimi doğrulandı
            </div>
            <DropdownMenuItem asChild>
              <Link href={APP_ROUTES.admin.account}>
                <HugeiconsIcon icon={UserCircleIcon} />
                Hesap ve güvenlik
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

function UserAvatar({ user, initials }: { user: AdminUser; initials: string }) {
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
