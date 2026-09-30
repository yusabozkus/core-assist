import { QuestionInbox } from "./question-inbox"
import { getServerProductQuestions } from "@/lib/api/questions.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"
import {
  PENDING_QUESTION_STATES,
  type PendingQuestionState,
  type ProductQuestionFilter,
} from "@/types/question"

export const dynamic = "force-dynamic"

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[]
    pending?: string | string[]
    q?: string | string[]
  }>
}) {
  const { activeStore } = await getOperationalStoreContext()
  const params = await searchParams
  const initialFilter = parseQuestionFilter(params.status)
  const initialPendingStates = parsePendingStates(params.pending)
  const initialQuery =
    (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? ""

  const initialPage = await getServerProductQuestions(activeStore.id, {
    status: initialFilter,
    pendingStates: initialPendingStates,
    query: initialQuery,
  })

  return (
    <QuestionInbox
      key={activeStore.id}
      storeId={activeStore.id}
      initialPage={initialPage}
      initialFilter={initialFilter}
      initialPendingStates={initialPendingStates}
      initialQuery={initialQuery}
    />
  )
}

function parsePendingStates(
  value: string | string[] | undefined
): PendingQuestionState[] {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (!rawValue) return [...PENDING_QUESTION_STATES]
  if (rawValue === "none") return []

  const requested = new Set(
    rawValue
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is PendingQuestionState =>
        PENDING_QUESTION_STATES.includes(item as PendingQuestionState)
      )
  )
  const states = PENDING_QUESTION_STATES.filter((state) => requested.has(state))

  return states.length > 0 ? states : [...PENDING_QUESTION_STATES]
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
