import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { runInThisContext } from "node:vm"
import ts from "typescript"

const source = readFileSync(
  new URL("../lib/require-onboarding.server.ts", import.meta.url),
  "utf8"
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
})

function guardWithStatus(status) {
  const loaded = { exports: {} }
  const require = (id) => {
    if (id === "server-only") return {}
    if (id === "next/navigation") {
      return {
        redirect: (path) => {
          throw Object.assign(new Error("redirect"), { path })
        },
      }
    }
    if (id === "@/constants/site") {
      return { APP_ROUTES: { login: "/login", onboarding: "/onboarding" } }
    }
    if (id === "@/lib/api/onboarding.server") {
      return { getOnboardingStatus: async () => status }
    }
    throw new Error(`Unexpected runtime import: ${id}`)
  }
  runInThisContext(`(function(require,module,exports){${outputText}\n})`)(
    require,
    loaded,
    loaded.exports
  )
  return loaded.exports.requireCompletedOnboarding
}

test("unfinished onboarding redirects protected pages to onboarding", async () => {
  await assert.rejects(guardWithStatus({ completed: false })(), {
    path: "/onboarding",
  })
})

test("completed onboarding permits protected pages", async () => {
  await assert.doesNotReject(guardWithStatus({ completed: true })())
})

test("missing session redirects to login", async () => {
  await assert.rejects(guardWithStatus(null)(), { path: "/login" })
})

test("status lookup failure does not permit protected pages", async () => {
  const failure = Promise.reject(new Error("status unavailable"))
  await assert.rejects(guardWithStatus(failure)(), /status unavailable/)
})
