import { AdminSectionPlaceholder } from "@/components/admin/admin-section-placeholder"

export default function AdminSystemPage() {
  return (
    <AdminSectionPlaceholder
      eyebrow="Altyapı görünürlüğü"
      title="Sistem sağlığı"
      description="API, worker, Redis, PostgreSQL, webhook ve pazaryeri entegrasyonlarının durumu burada izlenecek."
    />
  )
}
