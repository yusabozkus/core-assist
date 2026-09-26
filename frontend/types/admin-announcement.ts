export const ANNOUNCEMENT_ROLES = {
  OWNER: "Hesap sahipleri",
  ACCOUNT_ADMIN: "Hesap yöneticileri",
  STORE_ADMIN: "Mağaza yöneticileri",
  AGENT: "Temsilciler",
  VIEWER: "Görüntüleyiciler",
} as const

export type AnnouncementRole = keyof typeof ANNOUNCEMENT_ROLES
export type AnnouncementInput = {
  title: string
  message: string
  roles: AnnouncementRole[]
  sendEmail: boolean
}
export type AdminAnnouncement = AnnouncementInput & {
  id: string
  recipientCount: number
  emailCount: number
  skippedEmailCount: number
  createdAt: string
  expiresAt: string
  publishedAt: string | null
}
export type AnnouncementPreview = AdminAnnouncement & {
  sample: {
    name: string
    email: string
    workspaceName: string
    role: AnnouncementRole
  }[]
}
export type AnnouncementList = {
  items: AdminAnnouncement[]
  emailAvailable: boolean
}
