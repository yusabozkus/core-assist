import { redirect } from "next/navigation"

import { QuestionInbox } from "./question-inbox"
import { APP_ROUTES } from "@/constants/site"
import { getServerProductQuestions } from "@/lib/api/questions.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function InboxPage() {
  const { activeStore } = await getActiveStoreContext()

  if (!activeStore) {
    redirect(APP_ROUTES.onboarding)
  }

  const questions = await getServerProductQuestions(activeStore.id)

  return (
    <QuestionInbox
      storeId={activeStore.id}
      storeName={activeStore.name}
      questions={questions}
    />
  )
}
