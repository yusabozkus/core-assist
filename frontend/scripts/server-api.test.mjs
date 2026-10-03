import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { runInThisContext } from "node:vm"
import ts from "typescript"

// Execute the actual TS clients with only request context/transport replaced.
// React cache is a passthrough here; real request-scoped caching needs Next E2E.
function fixture(env = { API_URL: "http://backend:4001/" }) {
  const modules = new Map()
  const state = {
    cookie: "session=customer-a",
    calls: [],
    response: () => Response.json({ ok: true }),
  }
  function load(name) {
    if (modules.has(name)) return modules.get(name)
    const source = readFileSync(
      new URL(`../lib/api/${name}.ts`, import.meta.url),
      "utf8"
    )
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    })
    const loaded = { exports: {} }
    const require = (id) => {
      if (id === "server-only") return {}
      if (id === "next/headers")
        return {
          headers: async () =>
            new Headers(state.cookie ? { cookie: state.cookie } : {}),
        }
      if (id === "react") return { cache: (fn) => fn }
      if (id === "@/lib/api/server-fetch") return load("server-fetch")
      throw new Error(`Unexpected runtime import: ${id}`)
    }
    const execute = runInThisContext(
      `(function(require,module,exports,process,fetch){${outputText}\n})`,
      { filename: name }
    )
    execute(require, loaded, loaded.exports, { env }, async (url, options) => {
      state.calls.push({ url, ...options })
      return state.response(options)
    })
    modules.set(name, loaded.exports)
    return loaded.exports
  }
  return { state, load }
}

test("server transport uses private URL precedence and never shares cookies across requests", async () => {
  const { state, load } = fixture({
    API_URL: "http://backend:4001/",
    NEXT_PUBLIC_API_URL: "https://public.example",
  })
  const api = load("billing.server")
  const first = api.getServerBillingSummary("account/a")
  state.cookie = "session=customer-b"
  const second = api.getServerBillingSummary("account/b")
  await Promise.all([first, second])
  assert.equal(state.calls.length, 2)
  assert.deepEqual(
    state.calls.map((c) => c.headers.cookie),
    ["session=customer-a", "session=customer-b"]
  )
  assert.equal(
    state.calls[0].url,
    "http://backend:4001/workspaces/account%2Fa/billing/summary"
  )
  for (const call of state.calls) {
    assert.equal(call.cache, "no-store")
    assert.equal(call.headers.Accept, "application/json")
    assert.ok(call.signal instanceof AbortSignal)
  }
  assert.notEqual(state.calls[0].signal, state.calls[1].signal)
  for (const [env, base] of [
    [
      { NEXT_PUBLIC_API_URL: "https://public.example/" },
      "https://public.example",
    ],
    [{}, "http://localhost:4001"],
  ]) {
    const other = fixture(env)
    await other.load("server-fetch").fetchServerApi("/health", { cookie: null })
    assert.equal(other.state.calls[0].url, `${base}/health`)
  }
})

test("anonymous empty states and protected endpoints keep their distinct contracts without a fetch", async () => {
  const { state, load } = fixture()
  state.cookie = null
  assert.equal(
    (await load("questions.server").getServerProductQuestions("store")).total,
    0
  )
  assert.equal(
    (await load("catalog.server").getServerCatalogProducts("store")).items
      .length,
    0
  )
  assert.equal(
    (await load("catalog.server").getServerCatalogInventory("store"))
      .variantTotal,
    0
  )
  assert.equal(
    (await load("channels.server").getServerChannelConnections("store")).length,
    0
  )
  assert.equal(
    (await load("channels.server").getServerIntegrationProviders("store"))
      .length,
    0
  )
  assert.equal(
    (await load("channels.server").getServerChannelSyncHistory("store")).total,
    0
  )
  assert.equal((await load("stores.server").getServerStores()).length, 0)
  assert.equal(await load("onboarding.server").getOnboardingStatus(), null)
  for (const [file, fn, args] of [
    ["billing", "getServerBillingSummary", ["workspace"]],
    ["support", "getServerSupportTickets", []],
    ["admin-emails", "getServerAdminEmails", [{}]],
    ["users", "getServerAccountOverview", []],
    ["team", "getServerTeam", ["workspace"]],
  ])
    await assert.rejects(
      load(`${file}.server`)[fn](...args),
      /authenticat|session/
    )
  assert.equal(state.calls.length, 0)
})

test("domain-specific 404 errors and other HTTP errors remain distinguishable", async () => {
  const { state, load } = fixture()
  state.response = () => new Response(null, { status: 404 })
  for (const [file, fn, error] of [
    ["admin-emails", "getServerAdminEmail", "AdminEmailNotFoundError"],
    [
      "admin-contact",
      "getServerAdminContactMessage",
      "AdminContactMessageNotFoundError",
    ],
    ["admin-customers", "getServerAdminCustomer", "AdminCustomerNotFoundError"],
    [
      "admin-billing",
      "getServerAdminBillingDetail",
      "AdminBillingNotFoundError",
    ],
    [
      "admin-support",
      "getServerAdminSupportTicket",
      "AdminSupportTicketNotFoundError",
    ],
    ["support", "getServerSupportTicket", "SupportTicketNotFoundError"],
  ]) {
    const api = load(`${file}.server`)
    await assert.rejects(api[fn]("missing"), api[error])
  }
  await assert.rejects(
    load("support.server").getServerSupportTickets(),
    /status 404/
  )
  state.response = () => new Response(null, { status: 503 })
  await assert.rejects(
    load("questions.server").getServerProductQuestions("store"),
    /status 503/
  )
  await assert.rejects(
    load("admin-emails.server").getServerAdminEmail("id"),
    /failed with 503/
  )
})

test("public invitation preview never forwards the signed-in cookie", async () => {
  const { state, load } = fixture()
  state.response = () => new Response(null, { status: 404 })
  assert.equal(
    await load("team.server").getServerWorkspaceInvitation("token/secret"),
    null
  )
  assert.equal(
    state.calls[0].url,
    "http://backend:4001/workspace-invitations/token%2Fsecret"
  )
  assert.equal(state.calls[0].headers.cookie, undefined)
})

test("onboarding preserves unauthorized, invalid response and network failure handling", async () => {
  const { state, load } = fixture()
  const api = load("onboarding.server")
  for (const status of [401, 403]) {
    state.response = () => new Response(null, { status })
    assert.equal(await api.getOnboardingStatus(), null)
  }
  for (const response of [
    () => Response.json({ completed: "invalid" }),
    () => new Response("invalid json"),
    () => new Response(null, { status: 503 }),
    () => {
      throw new Error("network unavailable")
    },
  ]) {
    state.response = response
    await assert.rejects(
      api.getOnboardingStatus(),
      api.OnboardingStatusUnavailableError
    )
  }
  state.response = () => Response.json({ completed: true })
  assert.deepEqual(await api.getOnboardingStatus(), { completed: true })
})

test("transport deadline aborts a stalled request and rejects absolute targets", async () => {
  const { state, load } = fixture()
  const { fetchServerApi } = load("server-fetch")
  for (const path of [
    "https://other.example/private",
    "//other.example/private",
  ]) {
    assert.throws(
      () => fetchServerApi(path, { cookie: "session=test" }),
      /relative API path/
    )
  }
  assert.equal(state.calls.length, 0)
  state.response = ({ signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      })
    })
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(
      fetchServerApi("/slow", { cookie: "session=test", timeoutMs: 10 }),
      { name: "TimeoutError" }
    )
  } finally {
    clearTimeout(keepAlive)
  }
})
