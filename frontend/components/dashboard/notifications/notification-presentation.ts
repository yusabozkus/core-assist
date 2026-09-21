import {
  AiBrain01Icon,
  AlertCircleIcon,
  CustomerSupportIcon,
  InboxIcon,
  Package01Icon,
  PlugSocketIcon,
  RefreshIcon,
  Shield01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import type {
  NotificationSeverity,
  NotificationType,
} from "@/types/notification"

export const NOTIFICATION_TYPE_DETAILS: Record<
  NotificationType,
  {
    label: string
    icon: typeof AlertCircleIcon
  }
> = {
  BILLING_SUBSCRIPTION_CHANGED: {
    label: "Abonelik",
    icon: Package01Icon,
  },
  BILLING_CANCELLATION: { label: "Abonelik", icon: Package01Icon },
  BILLING_REFUND: { label: "Ödeme iadesi", icon: Package01Icon },
  AI_REVIEW_REQUIRED: { label: "İnceleme", icon: AiBrain01Icon },
  AI_DRAFT_FAILED: { label: "AI taslağı", icon: AiBrain01Icon },
  AI_AUTOMATION_PAUSED: { label: "AI otomasyonu", icon: AiBrain01Icon },
  AI_USAGE_LIMIT: { label: "Plan kullanımı", icon: AiBrain01Icon },
  ANSWER_DELIVERY_FAILED: { label: "Yanıt", icon: InboxIcon },
  PRODUCT_SYNC_FAILED: { label: "Ürün senkronizasyonu", icon: RefreshIcon },
  QUESTION_SYNC_FAILED: { label: "Soru senkronizasyonu", icon: RefreshIcon },
  LOW_STOCK: { label: "Stok", icon: Package01Icon },
  OUT_OF_STOCK: { label: "Stok", icon: Package01Icon },
  CHANNEL_CONNECTION_ERROR: { label: "Kanal", icon: PlugSocketIcon },
  BILLING_PLAN_LIMIT: { label: "Plan limiti", icon: Package01Icon },
  BILLING_PAYMENT_ISSUE: { label: "Abonelik ödemesi", icon: Package01Icon },
  TEAM_INVITATION_ACCEPTED: { label: "Ekip", icon: UserGroupIcon },
  TEAM_ACCESS_CHANGED: { label: "Ekip erişimi", icon: UserGroupIcon },
  SECURITY_ACCOUNT_CHANGED: { label: "Hesap güvenliği", icon: Shield01Icon },
  SECURITY_SESSIONS_REVOKED: {
    label: "Hesap güvenliği",
    icon: Shield01Icon,
  },
  SUPPORT_NEW_TICKET: {
    label: "Yeni destek talebi",
    icon: CustomerSupportIcon,
  },
  SUPPORT_CUSTOMER_MESSAGE: {
    label: "Destek mesajı",
    icon: CustomerSupportIcon,
  },
  SUPPORT_ADMIN_REPLY: { label: "Destek yanıtı", icon: CustomerSupportIcon },
  SUPPORT_SLA_BREACHED: { label: "SLA uyarısı", icon: CustomerSupportIcon },
  SUPPORT_ASSIGNMENT_CHANGED: {
    label: "Talep ataması",
    icon: CustomerSupportIcon,
  },
}

export const NOTIFICATION_SEVERITY_STYLES: Record<
  NotificationSeverity,
  {
    icon: string
    dot: string
    border: string
    accent: string
  }
> = {
  INFO: {
    icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
    border: "border-sky-500/20",
    accent: "bg-sky-500",
  },
  WARNING: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    border: "border-amber-500/25",
    accent: "bg-amber-500",
  },
  ERROR: {
    icon: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    border: "border-destructive/25",
    accent: "bg-destructive",
  },
}
