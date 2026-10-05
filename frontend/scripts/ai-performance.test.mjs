import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import { runInThisContext } from "node:vm"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const nodeRequire = createRequire(import.meta.url)
const modules = new Map()

function load(name) {
  if (modules.has(name)) return modules.get(name)
  const extension =
    name === "analytics-format" || name === "question-status-tones"
      ? "ts"
      : "tsx"
  const source = readFileSync(
    new URL(
      `../components/dashboard/${name === "question-status-tones" ? "inbox" : "analytics"}/${name}.${extension}`,
      import.meta.url
    ),
    "utf8"
  )
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  })
  const loaded = { exports: {} }
  const require = (id) => {
    if (id === "react/jsx-runtime" || id === "react") return nodeRequire(id)
    if (id === "next/link")
      return { __esModule: true, default: (props) => createElement("a", props) }
    if (id === "@/components/ui/button")
      return {
        Button: ({ children, asChild, ...props }) =>
          asChild ? children : createElement("button", props, children),
      }
    if (id === "@hugeicons/react") return { HugeiconsIcon: () => null }
    if (id === "@hugeicons/core-free-icons") return {}
    if (id === "@/constants/site")
      return { APP_ROUTES: { dashboard: { inbox: "/dashboard/inbox" } } }
    if (id === "./analytics-format") return load("analytics-format")
    if (id === "@/components/dashboard/inbox/question-status-tones")
      return load("question-status-tones")
    if (id === "./period-change") return load("period-change")
    if (id === "./metric-help") return load("metric-help")
    if (id === "@/components/ui/popover")
      return {
        Popover: ({ children }) => children,
        PopoverTrigger: ({ children }) => children,
        PopoverContent: () => null,
      }
    throw new Error(`Unexpected runtime import: ${id}`)
  }
  runInThisContext(`(function(require,module,exports){${outputText}\n})`)(
    require,
    loaded,
    loaded.exports
  )
  modules.set(name, loaded.exports)
  return loaded.exports
}

const { CurrentReviewWorkload } = load("current-review-workload")
const { PerformanceOverview } = load("performance-overview")
const { ReviewReasons } = load("review-reasons")
const { PeriodChange } = load("period-change")
const { AnalyticsSummary } = load("analytics-summary")

test("historical review results direct users to reasons, not a pending backlog", () => {
  const markup = renderToStaticMarkup(
    createElement(PerformanceOverview, {
      data: {
        delivery: { failed: 0, successRate: null },
        summary: {
          reviewedAnswers: 0,
          acceptanceRate: 0,
          averageConfidence: 0.8,
          confidenceSamples: 35,
        },
        answers: { aiAssisted: 0 },
        draftDecisions: { needsReview: 35, ready: 0 },
        automation: { mode: "OFF" },
      },
    })
  )
  assert.match(markup, /35 taslak/)
  assert.match(markup, /href="#review-reasons-title"/)
  assert.doesNotMatch(markup, /Bekleyenleri incele/)
})

test("zero current review shows no pending action even when historical results exist", () => {
  const markup = renderToStaticMarkup(
    createElement(CurrentReviewWorkload, { count: 0 })
  )
  assert.match(markup, /İnceleme bekleyen soru yok/)
  assert.doesNotMatch(markup, /<a[\s>]/)
})

test("the current review action opens only the review-required inbox filter", () => {
  const markup = renderToStaticMarkup(
    createElement(CurrentReviewWorkload, { count: 8 })
  )
  assert.match(markup, /8 soru/)
  assert.match(markup, /Tüm tarihler ve pazaryerleri/)
  assert.match(
    markup,
    /href="\/dashboard\/inbox\?status=PENDING&amp;pending=REVIEW_REQUIRED"/
  )
})

test("review reasons show counts and accessible actions without relying on a chart tooltip", () => {
  const markup = renderToStaticMarkup(
    createElement(ReviewReasons, {
      data: {
        draftDecisions: { needsReview: 12 },
        reviewReasons: [
          { key: "LOW_CONFIDENCE", count: 9 },
          { key: "MISSING_INFORMATION", count: 4 },
        ],
      },
      onInspect: () => {},
    })
  )
  assert.match(
    markup,
    /Güven eşiği karşılanmıyor: 9 taslak, soruları görüntüle/
  )
  assert.match(
    markup,
    /Ürün veya mağaza bilgisi eksik: 4 taslak, soruları görüntüle/
  )
  assert.equal((markup.match(/<button/g) ?? []).length, 2)
})

test("failed-send overview opens a detail action instead of the unfiltered inbox", () => {
  const markup = renderToStaticMarkup(
    createElement(PerformanceOverview, {
      data: {
        delivery: { failed: 3, successRate: 70 },
        summary: { averageConfidence: 0.8, confidenceSamples: 10 },
        answers: { aiAssisted: 7 },
        automation: { mode: "SAFE_AUTO" },
      },
      onInspectFailed: () => {},
    })
  )
  assert.match(markup, /Gönderimleri kontrol et/)
  assert.match(markup, /<button/)
  assert.doesNotMatch(markup, /href="\/dashboard\/inbox"/)
})

test("detail requests retain period, provider, snapshot, pagination and cancellation signal", async () => {
  const source = readFileSync(
    new URL("../lib/api/ai-performance.ts", import.meta.url),
    "utf8"
  )
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  })
  let request
  const loaded = { exports: {} }
  runInThisContext(`(function(require,module,exports){${outputText}\n})`)(
    (id) => {
      assert.equal(id, "@/lib/api/client")
      return {
        apiFetch: (path, init) => {
          request = { path, init }
          return Promise.resolve({ items: [] })
        },
      }
    },
    loaded,
    loaded.exports
  )
  const signal = new AbortController().signal
  const scope = {
    kind: "REVIEW_REASON",
    reason: "LOW_CONFIDENCE",
    range: "7D",
    provider: "trendyol",
    asOf: "2025-05-06T00:00:00Z",
  }
  await loaded.exports.getAiPerformanceQuestions(
    "store/a",
    scope,
    { questionId: "question-b", before: "2025-05-05T10:00:00Z" },
    signal
  )
  const url = new URL(request.path, "http://localhost")
  assert.equal(url.pathname, "/stores/store%2Fa/analytics/ai/questions")
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    ...scope,
    limit: "25",
    cursor: "question-b",
    before: "2025-05-05T10:00:00Z",
  })
  assert.equal(request.init.signal, signal)
  await loaded.exports.getAiPerformanceQuestions(
    "store-a",
    { ...scope, kind: "FAILED_DELIVERY", provider: null },
    null,
    signal
  )
  const failureUrl = new URL(request.path, "http://localhost")
  assert.equal(failureUrl.searchParams.has("reason"), false)
  assert.equal(failureUrl.searchParams.has("provider"), false)
  assert.equal(failureUrl.searchParams.has("cursor"), false)
})

test("volume changes never imply quality and do not divide by a zero baseline", () => {
  const increased = renderToStaticMarkup(
    createElement(PeriodChange, { kind: "count", current: 150, previous: 100 })
  )
  assert.match(increased, /%50 artış/)
  assert.doesNotMatch(increased, /emerald|amber/)
  const first = renderToStaticMarkup(
    createElement(PeriodChange, { kind: "count", current: 50, previous: 0 })
  )
  assert.match(first, /Önceki dönem: 0/)
  assert.doesNotMatch(first, /Infinity|NaN|artış/)
  const zero = renderToStaticMarkup(
    createElement(PeriodChange, { kind: "count", current: 0, previous: 0 })
  )
  assert.match(zero, /Değişim yok/)
  const small = renderToStaticMarkup(
    createElement(PeriodChange, {
      kind: "count",
      current: 100001,
      previous: 100000,
    })
  )
  assert.match(small, /%0,1’den az artış/)
  assert.doesNotMatch(small, /Değişim yok/)
})

test("rates use percentage points and lower review rates count as improvement", () => {
  const improvement = renderToStaticMarkup(
    createElement(PeriodChange, {
      kind: "rate",
      improvement: "down",
      current: 20,
      previous: 30,
    })
  )
  assert.match(improvement, /10 puan azalış/)
  assert.match(improvement, /text-emerald/)
  const worse = renderToStaticMarkup(
    createElement(PeriodChange, {
      kind: "rate",
      improvement: "up",
      current: 50,
      previous: 75,
    })
  )
  assert.match(worse, /25 puan azalış/)
  assert.match(worse, /text-amber/)
  const unavailable = renderToStaticMarkup(
    createElement(PeriodChange, {
      kind: "rate",
      improvement: "down",
      current: null,
      previous: 30,
    })
  )
  assert.match(unavailable, /Karşılaştırma için veri yok/)
  assert.doesNotMatch(unavailable, /azalış|emerald/)
})

test("summary hides comparisons for all-time and preserves a fall to zero volume", () => {
  const data = {
    summary: { totalDrafts: 0, uniqueQuestions: 0, reviewedAnswers: 0 },
    answers: { aiAssisted: 0, totalSent: 0 },
    draftDecisions: { needsReview: 0 },
    comparison: null,
  }
  const allTime = renderToStaticMarkup(
    createElement(AnalyticsSummary, { data })
  )
  assert.doesNotMatch(allTime, /Önceki:|Karşılaştırma/)
  const comparison = renderToStaticMarkup(
    createElement(AnalyticsSummary, {
      data: {
        ...data,
        comparison: {
          totalDrafts: 100,
          aiAssisted: 50,
          acceptanceRate: 75,
          needsReviewRate: 20,
        },
      },
    })
  )
  assert.match(comparison, /%100 azalış/)
  assert.match(comparison, /Karşılaştırma için veri yok/)
})

test("visible rate denominators distinguish manual approval from AI coverage and review history", () => {
  const markup = renderToStaticMarkup(
    createElement(AnalyticsSummary, {
      data: {
        summary: {
          totalDrafts: 100,
          uniqueQuestions: 35,
          reviewedAnswers: 20,
          acceptanceRate: 75,
          needsReviewRate: 10,
          aiCoverageRate: 60,
        },
        answers: { aiAssisted: 60, totalSent: 100, acceptedUnchanged: 15 },
        draftDecisions: { needsReview: 10 },
        comparison: null,
      },
    })
  )
  assert.match(markup, /15 \/ 20 kullanıcı onaylı AI yanıtı/)
  assert.doesNotMatch(markup, /15 \/ 60/)
  assert.match(markup, /Gönderilen 100 yanıtın %60’i/)
  assert.match(markup, /10 \/ 100 taslak/)
})

test("confidence is visibly distinct from accuracy and only missing samples render a dash", () => {
  const data = {
    summary: {
      totalDrafts: 35,
      uniqueQuestions: 10,
      reviewedAnswers: 0,
      averageConfidence: 0,
    },
    answers: { aiAssisted: 7 },
    delivery: { failed: 3, successRate: 70 },
    automation: { mode: "OFF" },
  }
  for (const samples of [0, 1]) {
    const markup = renderToStaticMarkup(
      createElement(PerformanceOverview, {
        data: {
          ...data,
          summary: { ...data.summary, confidenceSamples: samples },
        },
        onInspectFailed: () => {},
      })
    )
    assert.match(markup, /Doğruluk oranı değildir/)
    assert.match(markup, /7 \/ 10 sonuçlanan AI gönderimi/)
    const confidence = markup.slice(
      markup.indexOf("Ortalama AI güven puanı"),
      markup.indexOf("Doğruluk oranı değildir")
    )
    assert.match(confidence, samples ? />%0</ : />—</)
  }
})
