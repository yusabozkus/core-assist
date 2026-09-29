"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  Link01Icon,
  Loading03Icon,
  Mail01Icon,
  Tick02Icon,
  UserAdd01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  createTeamInvitation,
  getTeam,
  removeTeamMember,
  renewTeamInvitationLink,
  revokeTeamInvitation,
  updateTeamMember,
} from "@/lib/api/team"
import { getInitials } from "@/lib/utils"
import { getTeamAccessLabel } from "@/lib/team"
import type {
  InvitationLinkResult,
  TeamAccessLevel,
  TeamInvitation,
  TeamMember,
  TeamOverview,
} from "@/types/team"
import { TeamAccessFields } from "./team-access-fields"
import {
  GuidedSpotlightTour,
  type GuidedTourStep,
} from "@/components/dashboard/setup/response-settings-tour"

const teamTourSteps: GuidedTourStep[] = [
  {
    targets: ["[data-team-tour-invite]"],
    title: "Ekip üyesi davet edin",
    description:
      "Bir ekip arkadaşınızı e-posta ile davet edebilirsiniz. Davet sırasında rolünü ve erişebileceği mağazaları seçersiniz; tur davet göndermez.",
  },
  {
    targets: ["[data-team-tour-capacity]"],
    title: "Kapasiteyi takip edin",
    description:
      "Planınızın kullanıcı sınırını ve kullanılan koltuk sayısını burada izleyebilirsiniz. Bekleyen davetler de aşağıda listelenir.",
  },
  {
    targets: ["[data-team-tour-members]", "[data-team-tour-member]"],
    title: "Üyeleri ve yetkileri görün",
    description:
      "Burada her üyenin rolü ve mağaza erişimi görünür. Yetkiniz varsa düzenleme düğmesiyle rolünü değiştirebilir veya erişimini kaldırabilirsiniz.",
  },
]

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

export function TeamManagement({
  workspaceId,
  currentUserId,
  initialTeam,
}: {
  workspaceId: string
  currentUserId: string
  initialTeam: TeamOverview
}) {
  const searchParams = useSearchParams()
  const [tourOpen, setTourOpen] = React.useState(false)
  const [team, setTeam] = React.useState(initialTeam)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [editingMember, setEditingMember] = React.useState<TeamMember | null>(
    null
  )
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const progress = Math.min(100, team.capacity.percentage)

  React.useEffect(() => {
    if (searchParams.get("setupGuideTour") !== "1") return
    const url = new URL(window.location.href)
    url.searchParams.delete("setupGuideTour")
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    )
    window.requestAnimationFrame(() => setTourOpen(true))
  }, [searchParams])

  async function refreshTeam() {
    setTeam(await getTeam(workspaceId))
  }

  async function handleInvitationAction(
    invitation: TeamInvitation,
    action: "resend" | "revoke"
  ): Promise<boolean> {
    const key = `${action}:${invitation.id}`
    setBusyKey(key)
    setError(null)
    setNotice(null)
    try {
      if (action === "resend") {
        const result = await renewTeamInvitationLink(workspaceId, invitation.id)
        setTeam((current) => ({
          ...current,
          invitations: current.invitations.map((item) =>
            item.id === invitation.id ? result.invitation : item
          ),
        }))
        let copied = false
        try {
          await copyInvitationLink(result.acceptPath)
          copied = true
        } catch {
          copied = false
        }
        const deliveryMessage =
          result.emailDelivery === "SENT"
            ? "Yeni davet e-postası gönderildi."
            : result.emailDelivery === "PENDING"
              ? "Davet e-postası gönderim sırasında."
              : "E-posta gönderilemedi."
        setNotice(
          `${deliveryMessage} ${copied ? "Yeni bağlantı panoya kopyalandı." : "Bağlantı panoya kopyalanamadı."} Eski bağlantı artık geçersiz.`
        )
        return true
      } else {
        await revokeTeamInvitation(workspaceId, invitation.id)
      }
      await refreshTeam()
      return true
    } catch (caughtError) {
      setError(readError(caughtError))
      return false
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRemoveMember(member: TeamMember): Promise<boolean> {
    setBusyKey(`remove:${member.user.id}`)
    setError(null)
    try {
      await removeTeamMember(workspaceId, member.user.id)
      await refreshTeam()
      return true
    } catch (caughtError) {
      setError(readError(caughtError))
      return false
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-primary">Ekip yönetimi</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Erişimi doğru kişilere verin
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ekibinizi e-postayla davet edin, mağaza erişimlerini ve yetkileri
            tek yerden yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setTourOpen(true)}>
            Kısa tur
          </Button>
          <Button data-team-tour-invite="" onClick={() => setInviteOpen(true)}>
            <HugeiconsIcon icon={UserAdd01Icon} className="size-4" />
            Ekip üyesi davet et
          </Button>
        </div>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={UserGroupIcon} className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{team.workspace.name} ekibi</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {team.members.length} aktif üye
              {team.invitations.length
                ? ` · ${team.invitations.length} bekleyen davet`
                : ""}
            </p>
          </div>
        </div>
        <div
          data-team-tour-capacity=""
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Kullanıcı kapasitesi</span>
            <span className="font-semibold tabular-nums">
              {team.capacity.used} / {team.capacity.limit}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground"
        >
          {notice}
        </p>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div
          data-team-tour-members=""
          className="border-b border-border px-5 py-4 sm:px-6"
        >
          <h2 className="font-semibold">Ekip üyeleri</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aktif kullanıcılar ve erişebildikleri mağazalar
          </p>
        </div>
        <div className="divide-y divide-border">
          {team.members.map((member, index) => (
            <MemberRow
              key={member.user.id}
              member={member}
              currentUserId={currentUserId}
              canManageAccountAdmins={team.canInviteAccountAdmins}
              isRemoving={busyKey === `remove:${member.user.id}`}
              onEdit={() => setEditingMember(member)}
              onRemove={() => handleRemoveMember(member)}
              tourTarget={index === 0}
            />
          ))}
        </div>
      </section>

      {team.invitations.length ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="font-semibold">Bekleyen davetler</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Davet e-postalarının teslimat durumu burada görünür. Yeniden
              gönderme işlemi eski bağlantıyı geçersiz kılar.
            </p>
          </div>
          <div className="divide-y divide-border">
            {team.invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                busyKey={busyKey}
                onResend={() =>
                  void handleInvitationAction(invitation, "resend")
                }
                onRevoke={() => handleInvitationAction(invitation, "revoke")}
              />
            ))}
          </div>
        </section>
      ) : null}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceId}
        team={team}
        onCreated={refreshTeam}
      />
      <EditMemberDialog
        key={editingMember?.user.id ?? "empty-member"}
        member={editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        workspaceId={workspaceId}
        team={team}
        onUpdated={async () => {
          await refreshTeam()
          setEditingMember(null)
        }}
      />
      {tourOpen ? (
        <GuidedSpotlightTour
          eyebrow="Ekip ve yetkiler"
          steps={teamTourSteps}
          onClose={() => setTourOpen(false)}
        />
      ) : null}
    </div>
  )
}

function MemberRow({
  member,
  currentUserId,
  canManageAccountAdmins,
  isRemoving,
  onEdit,
  onRemove,
  tourTarget = false,
}: {
  member: TeamMember
  currentUserId: string
  canManageAccountAdmins: boolean
  isRemoving: boolean
  onEdit: () => void
  onRemove: () => Promise<boolean>
  tourTarget?: boolean
}) {
  const isCurrentUser = member.user.id === currentUserId
  const canEdit =
    !member.isOwner &&
    !isCurrentUser &&
    (canManageAccountAdmins || member.accessLevel !== "ACCOUNT_ADMIN")

  return (
    <div
      data-team-tour-member={tourTarget ? "" : undefined}
      className="flex items-center gap-3 px-5 py-4 sm:px-6"
    >
      <Avatar className="size-9">
        {member.user.image ? (
          <AvatarImage src={member.user.image} alt={member.user.name} />
        ) : null}
        <AvatarFallback className="bg-muted text-xs font-semibold">
          {getInitials(member.user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{member.user.name}</p>
          {isCurrentUser ? (
            <span className="text-[11px] text-muted-foreground">Siz</span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {member.user.email}
        </p>
      </div>
      <div className="hidden min-w-0 flex-1 lg:block">
        <p className="truncate text-xs text-muted-foreground">
          {member.accessLevel === "OWNER" ||
          member.accessLevel === "ACCOUNT_ADMIN"
            ? "Tüm mağazalar"
            : member.stores.map((store) => store.name).join(", ")}
        </p>
      </div>
      <Badge variant={member.isOwner ? "default" : "outline"}>
        {getTeamAccessLabel(member.accessLevel)}
      </Badge>
      {canEdit ? (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isRemoving}
            aria-label="Yetkiyi düzenle"
            onClick={onEdit}
          >
            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
          </Button>
          <ConfirmationPopover
            title="Ekip üyesini çıkarmak istiyor musunuz?"
            description={`${member.user.name} adlı kullanıcının bu çalışma alanındaki tüm mağaza erişimleri kaldırılacaktır.`}
            confirmLabel="Evet, çıkar"
            busy={isRemoving}
            onConfirm={onRemove}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isRemoving}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Ekipten çıkar"
            >
              <HugeiconsIcon
                icon={isRemoving ? Loading03Icon : Delete02Icon}
                className={isRemoving ? "size-4 animate-spin" : "size-4"}
              />
            </Button>
          </ConfirmationPopover>
        </div>
      ) : (
        <span className="size-8.5" aria-hidden="true" />
      )}
    </div>
  )
}

function InvitationRow({
  invitation,
  busyKey,
  onResend,
  onRevoke,
}: {
  invitation: TeamInvitation
  busyKey: string | null
  onResend: () => void
  onRevoke: () => Promise<boolean>
}) {
  const resendBusy = busyKey === `resend:${invitation.id}`
  const revokeBusy = busyKey === `revoke:${invitation.id}`
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <HugeiconsIcon icon={Link01Icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{invitation.email}</p>
          <Badge
            variant="outline"
            className={
              invitation.emailDelivery === "SENT"
                ? "border-primary/20 bg-primary/5 text-primary"
                : invitation.emailDelivery === "PENDING"
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                  : invitation.emailDelivery === "FAILED"
                    ? "border-destructive/20 bg-destructive/5 text-destructive"
                    : "text-muted-foreground"
            }
          >
            {invitation.emailDelivery === "SENT"
              ? "E-posta gönderildi"
              : invitation.emailDelivery === "PENDING"
                ? "Gönderim bekleniyor"
                : invitation.emailDelivery === "FAILED"
                  ? "Gönderilemedi"
                  : "E-posta yok"}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {getTeamAccessLabel(invitation.accessLevel)} · Son tarih{" "}
          {dateFormatter.format(new Date(invitation.expiresAt))}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={resendBusy || revokeBusy}
          onClick={onResend}
        >
          <HugeiconsIcon
            icon={resendBusy ? Loading03Icon : Mail01Icon}
            className={resendBusy ? "size-4 animate-spin" : "size-4"}
          />
          Yeniden gönder
        </Button>
        <ConfirmationPopover
          title="Daveti iptal etmek istiyor musunuz?"
          description={`${invitation.email} için oluşturulan bağlantı kalıcı olarak geçersiz hale gelecektir.`}
          confirmLabel="Evet, iptal et"
          busy={revokeBusy}
          onConfirm={onRevoke}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={resendBusy || revokeBusy}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Daveti iptal et"
          >
            <HugeiconsIcon
              icon={revokeBusy ? Loading03Icon : Delete02Icon}
              className={revokeBusy ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </ConfirmationPopover>
      </div>
    </div>
  )
}

function ConfirmationPopover({
  children,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
}: {
  children: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  busy: boolean
  onConfirm: () => Promise<boolean>
}) {
  const [open, setOpen] = React.useState(false)

  async function confirm() {
    const completed = await onConfirm()
    if (completed) setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) setOpen(nextOpen)
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription className="leading-5">
            {description}
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void confirm()}
          >
            <HugeiconsIcon
              icon={busy ? Loading03Icon : Delete02Icon}
              className={busy ? "size-4 animate-spin" : "size-4"}
            />
            {confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function InviteMemberDialog({
  open,
  onOpenChange,
  workspaceId,
  team,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  team: TeamOverview
  onCreated: (result: InvitationLinkResult) => Promise<void>
}) {
  const [email, setEmail] = React.useState("")
  const [accessLevel, setAccessLevel] = React.useState<TeamAccessLevel>("AGENT")
  const [storeIds, setStoreIds] = React.useState<string[]>(() =>
    team.stores[0] ? [team.stores[0].id] : []
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<InvitationLinkResult | null>(
    null
  )
  const [copied, setCopied] = React.useState(false)

  function reset() {
    setEmail("")
    setAccessLevel("AGENT")
    setStoreIds(team.stores[0] ? [team.stores[0].id] : [])
    setError(null)
    setCreated(null)
    setCopied(false)
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await createTeamInvitation(workspaceId, {
        email,
        accessLevel,
        storeIds: accessLevel === "ACCOUNT_ADMIN" ? undefined : storeIds,
      })
      setCreated(result)
      try {
        await onCreated(result)
      } catch {
        setError(
          "Davet oluşturuldu ancak ekip listesi yenilenemedi. Sayfayı yenileyebilirsiniz."
        )
      }
    } catch (caughtError) {
      setError(readError(caughtError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) reset()
      }}
      title={created ? "Davet oluşturuldu" : "Ekip üyesi davet et"}
      description={
        created
          ? created.emailDelivery === "SENT"
            ? "Davet e-postası gönderildi. İsterseniz bağlantıyı ayrıca kopyalayabilirsiniz."
            : created.emailDelivery === "PENDING"
              ? "Davet e-postası gönderim sırasında. Teslimat durumunu ekip ekranından takip edebilirsiniz."
              : "Davet oluşturuldu ancak e-posta gönderilemedi. Bağlantıyı kopyalayıp güvenli biçimde paylaşabilirsiniz."
          : "Davet bağlantısı bu e-posta adresine gönderilecek."
      }
      preventClose={submitting}
      contentClassName="sm:max-w-xl"
      footer={({ close }) =>
        created ? (
          <>
            <Button variant="outline" size="sm" onClick={close}>
              Kapat
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await copyInvitationLink(created.acceptPath)
                  setCopied(true)
                  setError(null)
                } catch (caughtError) {
                  setError(readError(caughtError))
                }
              }}
            >
              <HugeiconsIcon
                icon={copied ? Tick02Icon : Copy01Icon}
                className="size-4"
              />
              {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={close}>
              Vazgeç
            </Button>
            <Button
              size="sm"
              disabled={
                submitting ||
                !email.trim() ||
                (accessLevel !== "ACCOUNT_ADMIN" && !storeIds.length)
              }
              onClick={() => void submit()}
            >
              <HugeiconsIcon
                icon={submitting ? Loading03Icon : Mail01Icon}
                className={submitting ? "size-4 animate-spin" : "size-4"}
              />
              Davet gönder
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Davet edilen
            </p>
            <p className="mt-1 text-sm font-semibold">
              {created.invitation.email}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {getTeamAccessLabel(created.invitation.accessLevel)} · 7 gün
              geçerli
            </p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Bağlantıyı yeniden oluşturursanız önceki bağlantı geçersiz olur ve
            yeni bir davet e-postası gönderilir.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="invite-email" required>
              E-posta adresi
            </Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              value={email}
              disabled={submitting}
              placeholder="ekip@magaza.com"
              className="h-11 rounded-xl"
              onChange={(event) => setEmail(event.target.value)}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Daveti kabul eden Google veya Microsoft hesabı bu adresle
              eşleşmelidir.
            </p>
          </div>
          <TeamAccessFields
            accessLevel={accessLevel}
            onAccessLevelChange={setAccessLevel}
            stores={team.stores}
            selectedStoreIds={storeIds}
            onSelectedStoreIdsChange={setStoreIds}
            canAssignAccountAdmin={team.canInviteAccountAdmins}
            disabled={submitting}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </ResponsiveDialog>
  )
}

function EditMemberDialog({
  member,
  onOpenChange,
  workspaceId,
  team,
  onUpdated,
}: {
  member: TeamMember | null
  onOpenChange: (open: boolean) => void
  workspaceId: string
  team: TeamOverview
  onUpdated: () => Promise<void>
}) {
  const initialAccess =
    member?.accessLevel === "OWNER" ? "AGENT" : (member?.accessLevel ?? "AGENT")
  const [accessLevel, setAccessLevel] =
    React.useState<TeamAccessLevel>(initialAccess)
  const [storeIds, setStoreIds] = React.useState<string[]>(
    member?.stores.map((store) => store.id) ?? []
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function submit() {
    if (!member) return
    setSubmitting(true)
    setError(null)
    try {
      await updateTeamMember(workspaceId, member.user.id, {
        accessLevel,
        storeIds: accessLevel === "ACCOUNT_ADMIN" ? undefined : storeIds,
      })
      await onUpdated()
    } catch (caughtError) {
      setError(readError(caughtError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog
      open={member !== null}
      onOpenChange={onOpenChange}
      title="Üye yetkisini düzenle"
      description={
        member ? `${member.user.name} · ${member.user.email}` : undefined
      }
      preventClose={submitting}
      contentClassName="sm:max-w-xl"
      footer={({ close }) => (
        <>
          <Button variant="outline" size="sm" onClick={close}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            disabled={
              submitting ||
              (accessLevel !== "ACCOUNT_ADMIN" && !storeIds.length)
            }
            onClick={() => void submit()}
          >
            {submitting ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-4 animate-spin"
              />
            ) : null}
            Değişiklikleri kaydet
          </Button>
        </>
      )}
    >
      <TeamAccessFields
        accessLevel={accessLevel}
        onAccessLevelChange={setAccessLevel}
        stores={team.stores}
        selectedStoreIds={storeIds}
        onSelectedStoreIdsChange={setStoreIds}
        canAssignAccountAdmin={team.canInviteAccountAdmins}
        disabled={submitting}
      />
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </ResponsiveDialog>
  )
}

async function copyInvitationLink(acceptPath: string) {
  const url = new URL(acceptPath, window.location.origin).toString()
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(url)
    return
  }

  const input = document.createElement("textarea")
  input.value = url
  input.style.position = "fixed"
  input.style.opacity = "0"
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand("copy")
  input.remove()
  if (!copied) throw new Error("Davet bağlantısı kopyalanamadı.")
}

function readError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "İşlem tamamlanamadı. Lütfen tekrar deneyin."
}
