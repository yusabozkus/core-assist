import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { runInThisContext } from "node:vm"
import ts from "typescript"

const source = readFileSync(
  new URL("../lib/list-requests.ts", import.meta.url),
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
const { ListRequests } = loaded.exports

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

// These deferred responses intentionally ignore AbortSignal, including failures.
// The ownership guard must protect data, cursor, counts, errors and loading flags.
function load(requests, key, kind, response, state) {
  const request = requests.begin(key, kind)
  if (!request) return null
  state.loading = kind
  return response.promise
    .then((result) => {
      if (!requests.commit(request)) return
      Object.assign(state, result)
    })
    .catch((error) => {
      if (requests.isCurrent(request)) state.error = error.message
    })
    .finally(() => {
      if (requests.finish(request)) state.loading = null
    })
}

test("late pagination cannot contaminate a new filter's results or cursor", async () => {
  const requests = new ListRequests("A")
  requests.activate("A")
  const state = { items: ["a"], cursor: "a2", count: 20 }
  const old = deferred(),
    next = deferred()
  const oldJob = load(requests, "A", "more", old, state)
  requests.activate("B")
  assert.equal(requests.begin("B", "more"), null) // No old cursor during debounce.
  assert.equal(requests.begin("B", "refresh"), null)
  const newJob = load(requests, "B", "first", next, state)
  next.resolve({ items: ["b"], cursor: "b2", count: 7 })
  await newJob
  old.resolve({ items: ["a", "a2"], cursor: "a3", count: 20 })
  await oldJob
  assert.deepEqual(state, {
    items: ["b"],
    cursor: "b2",
    count: 7,
    loading: null,
  })
})

test("late error/finally cannot replace a new request's error or clear its spinner", async () => {
  const requests = new ListRequests("A")
  requests.activate("A")
  const state = {}
  const old = deferred(),
    next = deferred()
  const oldJob = load(requests, "A", "more", old, state)
  requests.activate("B")
  const newJob = load(requests, "B", "first", next, state)
  old.reject(new Error("old failure"))
  await oldJob
  assert.deepEqual(state, { loading: "first" })
  next.reject(new Error("current failure"))
  await newJob
  assert.deepEqual(state, { loading: null, error: "current failure" })
  assert.equal(requests.isReady("B"), false)
})

test("A → B → A never revives an old response, while already loaded A stays usable", () => {
  const requests = new ListRequests("A")
  requests.activate("A")
  const old = requests.begin("A", "more")
  requests.activate("B")
  const skipped = requests.begin("B", "first")
  requests.activate("A")
  assert.equal(requests.commit(old), false)
  assert.equal(requests.finish(skipped), false)
  assert.equal(requests.isReady("A"), true)
  assert.ok(requests.begin("A", "more"))
})

test("duplicate pagination is blocked synchronously and takes priority over polling", async () => {
  const requests = new ListRequests("A")
  requests.activate("A")
  const state = {}
  const poll = deferred(),
    more = deferred()
  const pollJob = load(requests, "A", "refresh", poll, state)
  const moreJob = load(requests, "A", "more", more, state)
  assert.equal(requests.begin("A", "more"), null)
  assert.equal(requests.begin("A", "refresh"), null)
  poll.resolve({ items: ["poll"], cursor: "old", count: 99 })
  await pollJob
  assert.deepEqual(state, { loading: "more" })
  more.resolve({ items: ["page"], cursor: "next" })
  await moreJob
  assert.deepEqual(state, { loading: null, items: ["page"], cursor: "next" })
})

test("unmount, store changes and Strict Mode cleanup reject obsolete requests", () => {
  const requests = new ListRequests("store-a")
  requests.activate("store-a")
  const first = requests.begin("store-a", "refresh")
  requests.dispose()
  assert.equal(first.signal.aborted, true)
  assert.equal(requests.commit(first), false)
  assert.equal(requests.begin("store-a", "first"), null)
  requests.activate("store-a")
  assert.equal(requests.isReady("store-a"), true)
  requests.activate("store-b")
  assert.equal(requests.isReady("store-b"), false)
  assert.equal(requests.begin("store-a", "first"), null)
})

test("canceling an old effect cannot abort a newer owner's request", () => {
  const requests = new ListRequests("A")
  requests.activate("A")
  const old = requests.begin("A", "first")
  const next = requests.begin("A", "first")
  requests.cancel(old)
  assert.equal(requests.isCurrent(next), true)
  assert.equal(next.signal.aborted, false)
})
