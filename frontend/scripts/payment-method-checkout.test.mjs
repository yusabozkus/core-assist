import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import ts from "typescript"

const require = createRequire(import.meta.url)
const source = readFileSync(
  new URL(
    "../components/dashboard/billing/payment-method-dialog.tsx",
    import.meta.url
  ),
  "utf8"
)
const compiled = ts.transpileModule(
  `${source}\nexport { PaymentMethodCheckout }`,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText

// Run the actual checkout effect with mocked hooks, SDK and API. No browser,
// external request, payment or database is used in these lifecycle tests.
function fixture({
  requiresPayment = false,
  statusError = false,
  prepareError = false,
  completed = true,
} = {}) {
  const state = []
  const effects = []
  const listeners = new Set()
  const calls = []
  const method = { type: "card", brand: "visa", last4: "4242" }
  const transactionId = "txn_test_transaction"
  const paddle = {
    Checkout: {
      open: (options) => calls.push(["open", options]),
      close: () => calls.push(["close"]),
    },
  }
  const router = { refresh: () => calls.push(["refresh"]) }
  const modules = {
    react: {
      useEffect: (effect) => effects.push(effect),
      useId: () => "_test_1_",
      useRef: (value) => ({ current: value }),
      useState: (initial) => {
        const index = state.length
        state.push(initial)
        return [
          initial,
          (value) => {
            state[index] =
              typeof value === "function" ? value(state[index]) : value
          },
        ]
      },
    },
    "next/navigation": { useRouter: () => router },
    "@/lib/paddle": {
      getPaddle: () => Promise.resolve(paddle),
      subscribeToPaddleEvents: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    "@/lib/api/billing": {
      createPaymentMethodCheckout: async (workspaceId) => {
        calls.push(["prepare", workspaceId])
        if (prepareError) throw new Error("Yetki yok")
        return {
          transactionId,
          requiresPayment,
          currency: "TRY",
          amountDue: 0,
          subtotal: 0,
          tax: 0,
          total: 0,
          items: [],
        }
      },
      getPaymentMethodCheckoutStatus: async (...args) => {
        calls.push(["verify", ...args.slice(0, 2)])
        if (statusError) throw new Error("Paddle unavailable")
        return { completed, paymentMethod: completed ? method : null }
      },
      refreshBillingSubscription: async (workspaceId) => {
        calls.push(["reconcile", workspaceId])
      },
    },
    "@/lib/format-currency": { formatCurrency: (value) => String(value) },
  }
  const compiledModule = { exports: {} }
  new Function("require", "module", "exports", compiled)(
    (name) => {
      if (name === "react/jsx-runtime") return require(name)
      if (modules[name]) return modules[name]
      return new Proxy({}, { get: (_, key) => String(key) })
    },
    compiledModule,
    compiledModule.exports
  )
  const oldWindow = globalThis.window
  const oldDocument = globalThis.document
  globalThis.window = {
    setTimeout,
    clearTimeout,
    dispatchEvent: () => calls.push(["billing-updated"]),
  }
  globalThis.document = {
    documentElement: { classList: { contains: () => false } },
  }
  compiledModule.exports.PaymentMethodCheckout({
    workspaceId: "workspace-a",
    onClose: () => {},
    onUpdated: (value) => calls.push(["updated", value]),
  })
  const cleanup = effects.map((effect) => effect())
  return {
    calls,
    state,
    transactionId,
    method,
    emit: (event) => listeners.forEach((listener) => listener(event)),
    dispose: () => {
      cleanup.forEach((stop) => stop?.())
      globalThis.window = oldWindow
      globalThis.document = oldDocument
    },
  }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

test("payment update opens an inline checkout with no navigation and ignores other transactions", async () => {
  const f = fixture()
  try {
    await tick()
    const options = f.calls.find(([name]) => name === "open")[1]
    assert.equal(options.transactionId, f.transactionId)
    assert.equal(options.settings.displayMode, "inline")
    assert.equal(options.settings.locale, "tr")
    assert.ok(!("successUrl" in options.settings))
    f.emit({
      name: "checkout.completed",
      data: { transaction_id: "unrelated" },
    })
    f.emit({ name: "checkout.completed" })
    await tick()
    assert.ok(!f.calls.some(([name]) => name === "verify"))
  } finally {
    f.dispose()
  }
})

test("completion is verified once on the server before showing the new card and refreshing", async () => {
  const f = fixture()
  try {
    await tick()
    const event = {
      name: "checkout.completed",
      data: { transaction_id: f.transactionId },
    }
    f.emit(event)
    f.emit(event)
    await tick()
    assert.equal(f.calls.filter(([name]) => name === "verify").length, 1)
    const names = f.calls.map(([name]) => name)
    assert.ok(names.indexOf("verify") < names.indexOf("updated"))
    assert.ok(names.indexOf("updated") < names.indexOf("refresh"))
    assert.deepEqual(f.calls.find(([name]) => name === "updated")[1], f.method)
    assert.ok(!names.includes("reconcile"))
    assert.ok(f.state.includes("complete"))
  } finally {
    f.dispose()
  }
})

test("an overdue payment also reconciles the subscription without trusting iframe access claims", async () => {
  const f = fixture({ requiresPayment: true })
  try {
    await tick()
    f.emit({
      name: "checkout.completed",
      data: { transaction_id: f.transactionId },
    })
    await tick()
    const names = f.calls.map(([name]) => name)
    assert.ok(names.indexOf("verify") < names.indexOf("reconcile"))
    assert.ok(names.indexOf("reconcile") < names.indexOf("billing-updated"))
  } finally {
    f.dispose()
  }
})

test("failed verification keeps the result pending without claiming success or reopening payment", async () => {
  const f = fixture({ statusError: true })
  try {
    await tick()
    f.emit({
      name: "checkout.completed",
      data: { transaction_id: f.transactionId },
    })
    await tick()
    assert.ok(f.state.includes("pending"))
    assert.ok(
      !f.calls.some(([name]) => name === "updated" || name === "refresh")
    )
    assert.equal(f.calls.filter(([name]) => name === "prepare").length, 1)
  } finally {
    f.dispose()
  }
})

test("a preparation failure never opens Paddle and allows a clear retry state", async () => {
  const f = fixture({ prepareError: true })
  try {
    await tick()
    assert.ok(f.state.includes("error"))
    assert.ok(f.state.includes("Yetki yok"))
    assert.ok(!f.calls.some(([name]) => name === "open"))
  } finally {
    f.dispose()
  }
})

test("unmount stops verification and closes the owned form without any later success", async () => {
  const f = fixture({ completed: false })
  await tick()
  f.emit({
    name: "checkout.completed",
    data: { transaction_id: f.transactionId },
  })
  await tick()
  f.dispose()
  await tick()
  assert.equal(f.calls.filter(([name]) => name === "close").length, 1)
  assert.ok(!f.calls.some(([name]) => name === "updated" || name === "refresh"))
})

test("payment errors without transaction data remain visible and can be retried inside the form", async () => {
  const f = fixture()
  try {
    await tick()
    f.emit({
      name: "checkout.payment.error",
      detail: "Sensitive provider detail",
    })
    assert.ok(
      f.state.some(
        (value) =>
          typeof value === "string" && value.includes("Bilgilerinizi kontrol")
      )
    )
    assert.ok(!f.state.includes("Sensitive provider detail"))
    f.emit({
      name: "checkout.payment.initiated",
      data: { transaction_id: f.transactionId },
    })
    assert.equal(f.state[3], null)
  } finally {
    f.dispose()
  }
})

test("the displayed outstanding amount follows Paddle's updated balance rather than an older total", async () => {
  const f = fixture({ requiresPayment: true })
  try {
    await tick()
    f.emit({
      name: "checkout.updated",
      data: {
        transaction_id: f.transactionId,
        currency_code: "TRY",
        totals: { subtotal: 100, tax: 20, total: 120, balance: 60 },
      },
    })
    assert.equal(f.state[2].amountDue, 60)
    assert.equal(f.state[2].total, 120)
    assert.ok(f.state.includes("ready"))
  } finally {
    f.dispose()
  }
})
