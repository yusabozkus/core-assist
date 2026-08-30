import { QuestionInbox } from "./question-inbox"
import { getServerProductQuestions } from "@/lib/api/questions.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function InboxPage() {
  const { activeStore } = await getOperationalStoreContext()

  const questions = await getServerProductQuestions(activeStore.id)

  return <QuestionInbox storeId={activeStore.id} questions={questions} />
}
