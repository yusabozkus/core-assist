import { QuestionInbox } from "./question-inbox"
import { getServerProductQuestions } from "@/lib/api/questions.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function InboxPage() {
  const { activeStore } = await getOperationalStoreContext()

  const initialPage = await getServerProductQuestions(activeStore.id)

  return (
    <QuestionInbox
      key={activeStore.id}
      storeId={activeStore.id}
      initialPage={initialPage}
    />
  )
}
