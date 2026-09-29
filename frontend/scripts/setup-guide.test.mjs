import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { runInThisContext } from "node:vm"
import ts from "typescript"

const source = readFileSync(
  new URL("../lib/setup-guide.ts", import.meta.url),
  "utf8"
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
})
const loaded = { exports: {} }
runInThisContext(`(function(module,exports){${outputText}\n})`)(
  loaded,
  loaded.exports
)
const {
  getSetupGuideProgress,
  getSetupGuidePreviewProgress,
  initialSetupGuidePreviewState,
} = loaded.exports

function knowledge(overrides = {}) {
  return {
    profile: {
      tone: "PROFESSIONAL",
      responseLength: "BALANCED",
      automationMode: "OFF",
      greetingEnabled: true,
      closingEnabled: true,
      heightWeightSizeRecommendationEnabled: false,
      emojiPolicy: "NEVER",
      preferredEmoji: null,
      brandDescription: null,
      shippingPolicy: null,
      returnPolicy: null,
      exchangePolicy: null,
      warrantyPolicy: null,
      additionalInformation: null,
      ...overrides.profile,
    },
    instructions: overrides.instructions ?? [
      { content: "Müşteriye her zaman siz diliyle hitap et.", active: true },
    ],
    faqs: overrides.faqs ?? [],
  }
}

test("guide starts at zero when its visible steps are incomplete", () => {
  const progress = getSetupGuideProgress(knowledge(), {
    total: 0,
    answered: 0,
  })
  assert.equal(progress.percentage, 0)
  assert.equal(progress.nextStep, "AI")
  assert.equal(progress.hasQuestions, false)
})

test("manager's four visible steps complete core setup", () => {
  const progress = getSetupGuideProgress(
    knowledge({
      profile: { tone: "WARM", shippingPolicy: "Kargo süresi 2 gün." },
    }),
    null,
    { channelsVisited: true, teamVisited: true }
  )
  assert.equal(progress.percentage, 100)
  assert.equal(progress.aiStepComplete, true)
  assert.equal(progress.storeInformationAdded, true)
  assert.equal(progress.channelsVisited, true)
  assert.equal(progress.teamVisited, true)
})

test("visiting response settings completes the AI step without changing defaults", () => {
  const progress = getSetupGuideProgress(knowledge(), null, {
    aiSettingsVisited: true,
  })
  assert.equal(progress.aiStepComplete, true)
  assert.equal(progress.percentage, 25)
  assert.equal(progress.nextStep, "STORE")
})

test("a custom instruction counts as personalization, while inactive FAQ does not", () => {
  const progress = getSetupGuideProgress(
    knowledge({
      instructions: [{ content: "Müşteriyi adıyla karşıla.", active: true }],
      faqs: [{ question: "Kargo?", answer: "İki gün.", active: false }],
    }),
    null
  )
  assert.equal(progress.percentage, 25)
  assert.equal(progress.faqAdded, false)
  assert.equal(progress.nextStep, "STORE")
})

test("FAQ and customer questions remain optional for core progress", () => {
  const progress = getSetupGuideProgress(
    knowledge({
      faqs: [{ question: "Kargo?", answer: "İki gün.", active: true }],
    }),
    { total: 3, answered: 1 }
  )
  assert.equal(progress.percentage, 0)
  assert.equal(progress.faqAdded, true)
  assert.equal(progress.hasQuestions, true)
  assert.equal(progress.hasAnsweredQuestion, true)
})

test("preview starts at the first step even when store data is already complete", () => {
  const actual = getSetupGuideProgress(
    knowledge({
      profile: { tone: "WARM", shippingPolicy: "Kargo süresi 2 gün." },
    }),
    { total: 3, answered: 1 },
    { aiSettingsVisited: true, channelsVisited: true, teamVisited: true }
  )
  const preview = getSetupGuidePreviewProgress(
    actual,
    initialSetupGuidePreviewState
  )
  assert.equal(actual.percentage, 100)
  assert.equal(preview.percentage, 0)
  assert.equal(preview.nextStep, "AI")
  assert.equal(preview.hasAnsweredQuestion, false)
})

test("channels and team are required before manager reaches 100 percent", () => {
  const core = knowledge({
    profile: { tone: "WARM", shippingPolicy: "Kargo süresi 2 gün." },
  })
  const beforeChannels = getSetupGuideProgress(core, null)
  assert.equal(beforeChannels.percentage, 50)
  assert.equal(beforeChannels.nextStep, "CHANNELS")
  const beforeTeam = getSetupGuideProgress(core, null, {
    channelsVisited: true,
  })
  assert.equal(beforeTeam.percentage, 75)
  assert.equal(beforeTeam.nextStep, "TEAM")
})

test("non-managers complete accessible steps without team access", () => {
  const progress = getSetupGuideProgress(
    knowledge({
      profile: { tone: "WARM", shippingPolicy: "Kargo süresi 2 gün." },
    }),
    null,
    { channelsVisited: true, canManageTeam: false }
  )
  assert.equal(progress.percentage, 100)
  assert.equal(progress.teamStepRequired, false)
})
