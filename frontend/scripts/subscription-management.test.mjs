import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import ts from "typescript"

const require = createRequire(import.meta.url)
const source = readFileSync(
  new URL(
    "../components/dashboard/billing/cancel-subscription-dialog.tsx",
    import.meta.url
  ),
  "utf8"
)
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const tick = () => new Promise((resolve) => setImmediate(resolve))

// Exercise the real dialog handlers and re-renders with in-memory API responses.
// These tests never open a browser or contact Paddle/the application database.
function fixture({
  reverse = false,
  lostResponse = false,
  synchronized = true,
  blocked = false,
  delayed = false,
} = {}) {
  const calls = []
  const hooks = []
  const cleanups = []
  let cursor = 0
  let current = {
    subscriptionId: "sub-current",
    updatedAt: "2026-10-05T12:00:00Z",
    status: blocked ? "canceled" : "active",
    cancellationScheduled: reverse,
    scheduledChangeAction: reverse ? "cancel" : null,
    accessEndsAt: "2026-11-05T12:00:00Z",
    nextBilledAt: reverse ? null : "2026-11-05T12:00:00Z",
    action: blocked ? null : reverse ? "reverse_cancellation" : "cancel",
    blockedReason: blocked ? "Abonelik sona ermiş." : null,
  }
  let release
  const gate = delayed
    ? new Promise((resolve) => {
        release = resolve
      })
    : Promise.resolve()
  class ApiError extends Error {}
  const modules = {
    react: {
      useState: (initial) => {
        const index = cursor++
        if (!(index in hooks)) hooks[index] = initial
        return [
          hooks[index],
          (value) => {
            hooks[index] =
              typeof value === "function" ? value(hooks[index]) : value
          },
        ]
      },
      useRef: (initial) => {
        const index = cursor++
        if (!(index in hooks)) hooks[index] = { current: initial }
        return hooks[index]
      },
      useEffect: (effect) => {
        const index = cursor++
        if (!(index in hooks)) {
          hooks[index] = true
          cleanups.push(effect())
        }
      },
    },
    "next/navigation": {
      useRouter: () => ({ refresh: () => calls.push("refresh") }),
    },
    "@/lib/api/client": { ApiError },
    "@/lib/billing": { formatBillingDate: (value) => value },
    "@/lib/billing-routes": {
      billingRoutes: () => ({ plans: "/billing/ws/plans" }),
    },
    "@/lib/api/billing": {
      getSubscriptionManagement: () => {
        calls.push("read")
        return Promise.resolve({ ...current })
      },
      manageBillingSubscription: async (_workspaceId, input) => {
        calls.push(["write", input])
        await gate
        const cancel = input.action === "cancel"
        current = {
          ...current,
          cancellationScheduled: cancel,
          scheduledChangeAction: cancel ? "cancel" : null,
          action: cancel ? "reverse_cancellation" : "cancel",
        }
        if (lostResponse) throw new Error("Network connection lost")
        return { completed: true, synchronized, subscription: { ...current } }
      },
      refreshBillingSubscription: () => {
        calls.push("reconcile")
        return Promise.resolve({
          subscription: {
            status: current.status.toUpperCase(),
            cancelAtPeriodEnd: current.cancellationScheduled,
          },
        })
      },
    },
  }
  const compiledModule = { exports: {} }
  new Function("require", "module", "exports", compiled)(
    (name) => {
      if (name === "react/jsx-runtime") return require(name)
      return modules[name] ?? new Proxy({}, { get: (_, key) => String(key) })
    },
    compiledModule,
    compiledModule.exports
  )
  const oldWindow = globalThis.window
  globalThis.window = { dispatchEvent: () => calls.push("billing-updated") }
  function render() {
    cursor = 0
    return compiledModule.exports.CancelSubscriptionDialog({
      workspaceId: "ws",
      cancellationScheduled: reverse,
      status: "ACTIVE",
    }).props
  }
  function textOf(node) {
    if (node == null || typeof node === "boolean") return ""
    if (typeof node === "string") return node
    if (Array.isArray(node)) return node.map(textOf).join("")
    return textOf(node.props?.children)
  }
  function button(label) {
    const content = render().footer({
      close: () => render().onOpenChange(false),
    })
    function find(node) {
      if (node == null || typeof node !== "object") return null
      if (Array.isArray(node)) return node.map(find).find(Boolean)
      if (node.type === "Button" && textOf(node) === label) return node
      return find(node.props?.children)
    }
    return find(content)
  }
  return {
    calls,
    render,
    button,
    release,
    open: async () => {
      render().onOpenChange(true)
      await tick()
    },
    setCurrent: (patch) => {
      current = { ...current, ...patch }
    },
    dispose: () => {
      cleanups.forEach((cleanup) => cleanup?.())
      globalThis.window = oldWindow
    },
  }
}

test("opening the dialog reads live state without any subscription mutation and keeps dismissal explicit", async () => {
  const f = fixture()
  try {
    await f.open()
    assert.deepEqual(f.calls, ["read"])
    assert.equal(f.render().dismissOnOutsideInteraction, false)
    assert.equal(f.render().dismissOnEscape, false)
    assert.ok(f.button("Yenilemeyi durdur"))
  } finally {
    f.dispose()
  }
})

test("a confirmed cancellation refreshes the account but leaves the success dialog open", async () => {
  const f = fixture()
  try {
    await f.open()
    f.button("Yenilemeyi durdur").props.onClick()
    await tick()
    assert.equal(f.calls.filter((call) => Array.isArray(call)).length, 1)
    assert.equal(f.render().title, "Abonelik güncellendi")
    assert.equal(f.render().open, true)
    assert.ok(f.calls.includes("billing-updated"))
    assert.ok(f.button("Tamam"))
  } finally {
    f.dispose()
  }
})

test("double clicks submit only once and closing is blocked during the request", async () => {
  const f = fixture({ delayed: true })
  try {
    await f.open()
    const confirm = f.button("Yenilemeyi durdur")
    confirm.props.onClick()
    confirm.props.onClick()
    f.render().onOpenChange(false)
    assert.equal(f.render().open, true)
    assert.equal(f.render().preventClose, true)
    assert.equal(f.calls.filter((call) => Array.isArray(call)).length, 1)
    f.release()
    await tick()
  } finally {
    f.dispose()
  }
})

test("lost responses are resolved with reads and reconciliation, never a second cancellation", async () => {
  const f = fixture({ lostResponse: true })
  try {
    await f.open()
    f.button("Yenilemeyi durdur").props.onClick()
    await tick()
    assert.ok(!f.calls.includes("refresh"))
    assert.ok(!f.button("Yenilemeyi durdur"))
    f.button("Durumu kontrol et").props.onClick()
    await tick()
    assert.equal(f.calls.filter((call) => Array.isArray(call)).length, 1)
    assert.ok(f.calls.includes("reconcile"))
    assert.equal(f.render().title, "Abonelik güncellendi")
  } finally {
    f.dispose()
  }
})

test("an undo with failed local synchronization waits for verified account state", async () => {
  const f = fixture({ reverse: true, synchronized: false })
  try {
    await f.open()
    f.button("İptali geri al").props.onClick()
    await tick()
    assert.ok(!f.calls.includes("refresh"))
    f.button("Durumu kontrol et").props.onClick()
    await tick()
    assert.match(f.render().description, /yenilenmeye devam/)
    assert.equal(f.calls.filter((call) => Array.isArray(call)).length, 1)
  } finally {
    f.dispose()
  }
})

test("stale server-rendered cancellation state never controls the action shown after live loading", async () => {
  const f = fixture({ reverse: true })
  try {
    f.setCurrent({
      cancellationScheduled: false,
      scheduledChangeAction: null,
      action: "cancel",
    })
    await f.open()
    assert.ok(f.button("Yenilemeyi durdur"))
    assert.ok(!f.button("İptali geri al"))
  } finally {
    f.dispose()
  }
})

test("terminal cancellations offer a new plan rather than an invalid reactivation", async () => {
  const f = fixture({ blocked: true })
  try {
    await f.open()
    assert.ok(f.button("Yeni plan seç"))
    assert.ok(!f.button("Yenilemeyi durdur"))
    assert.ok(!f.button("İptali geri al"))
    assert.deepEqual(f.calls, [
      "read",
      "reconcile",
      "billing-updated",
      "refresh",
    ])
  } finally {
    f.dispose()
  }
})

test("leaving the page during a mutation never refreshes or notifies an unrelated page", async () => {
  const f = fixture({ delayed: true })
  await f.open()
  f.button("Yenilemeyi durdur").props.onClick()
  f.dispose()
  f.release()
  await tick()
  assert.ok(!f.calls.includes("refresh"))
  assert.ok(!f.calls.includes("billing-updated"))
})

test("a different scheduled action does not falsely confirm an unknown undo", async () => {
  const f = fixture({ reverse: true, lostResponse: true })
  try {
    await f.open()
    f.button("İptali geri al").props.onClick()
    await tick()
    f.setCurrent({ scheduledChangeAction: "pause", action: null })
    f.button("Durumu kontrol et").props.onClick()
    await tick()
    assert.ok(!f.calls.includes("refresh"))
    assert.ok(!f.calls.includes("reconcile"))
    assert.ok(f.button("Durumu kontrol et"))
  } finally {
    f.dispose()
  }
})
