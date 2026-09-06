import { QuestionInbox } from "./question-inbox"
import { getServerProductQuestions } from "@/lib/api/questions.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"
import type { ProductQuestionFilter } from "@/types/question"

export const dynamic = "force-dynamic"

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>
}) {
  const { activeStore } = await getOperationalStoreContext()
  const params = await searchParams
  const initialFilter = parseQuestionFilter(params.status)

  const initialPage = await getServerProductQuestions(activeStore.id, {
    status: initialFilter,
  })

  return (
    <QuestionInbox
      key={activeStore.id}
      storeId={activeStore.id}
      initialPage={initialPage}
      initialFilter={initialFilter}
    />
  )
}

function parseQuestionFilter(
  value: string | string[] | undefined
): ProductQuestionFilter {
  const normalized = (Array.isArray(value) ? value[0] : value)?.toUpperCase()

  return normalized === "PENDING" ||
    normalized === "ANSWERED" ||
    normalized === "IGNORED"
    ? normalized
    : "PENDING"
}
