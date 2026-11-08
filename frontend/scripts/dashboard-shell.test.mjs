import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import { runInThisContext } from "node:vm"
import ts from "typescript"

const nodeRequire = createRequire(import.meta.url)
const layouts = [
  "app/(dashboard)/dashboard/layout.tsx",
  "app/(support-dashboard)/dashboard/support/layout.tsx",
]
const components = {
  "@/components/dashboard/billing/billing-payment-issue-banner": [
    "BillingPaymentIssueShell",
  ],
  "@/components/dashboard/billing/billing-usage-provider": [
    "BillingUsageProvider",
  ],
  "@/components/dashboard/setup/setup-guide": ["SetupGuide"],
  "@/components/shared/dashboard/dashboard-header": ["DashboardHeader"],
  "@/components/shared/dashboard/mobile-bottom-navigation": [
    "MobileBottomNavigation",
  ],
  "@/components/shared/sidebar/app-sidebar": ["AppSidebar"],
  "@/components/ui/sidebar": ["SidebarInset", "SidebarProvider"],
  "@/components/ui/sonner": ["Toaster"],
}

// Run both real route layouts and their server shell. Only Next request context,
// API transport and leaf client components are replaced; no DB/browser is used.
function fixture(accessLevel = "AGENT") {
  const activeStore = { id: "store-a", status: "ACTIVE", accessLevel }
  const state = {
    currentUser: {
      user: {
        id: "member",
        name: "Member",
        email: "member@example.test",
        image: "avatar",
      },
    },
    onboarding: { completed: true },
    context: { activeStore, stores: [activeStore] },
    billingWorkspaces: [],
    usage: { status: "ACTIVE" },
    connections: [],
    sidebarCookie: undefined,
    calls: [],
    channelError: null,
  }
  const modules = new Map()
  function load(path) {
    if (modules.has(path)) return modules.get(path)
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    const loaded = { exports: {} }
    const require = (id) => {
      if (id === "server-only") return {}
      if (id === "react/jsx-runtime") return nodeRequire(id)
      if (id === "@hugeicons/core-free-icons") return {}
      if (components[id]) {
        return Object.fromEntries(components[id].map((name) => [name, name]))
      }
      if (id === "next/headers") {
        return {
          cookies: async () => ({
            get: () => ({ value: state.sidebarCookie }),
          }),
        }
      }
      if (id === "next/navigation") {
        return {
          redirect: (path) => {
            throw Object.assign(new Error("redirect"), { path })
          },
        }
      }
      if (id === "@/lib/server-auth") {
        return { getCurrentUser: async () => state.currentUser }
      }
      if (id === "@/lib/api/onboarding.server") {
        return { getOnboardingStatus: async () => state.onboarding }
      }
      if (id === "@/lib/stores/active-store") {
        return {
          getActiveStoreContext: async () => {
            state.calls.push(["stores"])
            return state.context
          },
        }
      }
      if (id === "@/lib/api/channels.server") {
        return {
          getServerChannelConnections: async (storeId) => {
            state.calls.push(["channels", storeId])
            if (state.channelError) throw state.channelError
            return state.connections
          },
        }
      }
      if (id === "@/lib/api/billing.server") {
        return {
          getServerBillingWorkspaces: async () => state.billingWorkspaces,
          getServerStoreBillingUsage: async (storeId) => {
            state.calls.push(["usage", storeId])
            return state.usage
          },
        }
      }
      if (id.startsWith("@/")) {
        const local = id.slice(2)
        return load(
          `${local}.${local.startsWith("components/") ? "tsx" : "ts"}`
        )
      }
      throw new Error(`Unexpected runtime import: ${id}`)
    }
    runInThisContext(`(function(require,module,exports){${outputText}\n})`, {
      filename: path,
    })(require, loaded, loaded.exports)
    modules.set(path, loaded.exports)
    return loaded.exports
  }
  async function render(path) {
    const layout = load(path)
    assert.equal(layout.dynamic, "force-dynamic")
    const element = layout.default({ children: "page-content" })
    return element.type(element.props)
  }
  return { state, render, access: load("lib/dashboard-access.ts") }
}

function find(tree, type) {
  if (Array.isArray(tree)) return tree.flatMap((child) => find(child, type))
  if (!tree || typeof tree !== "object") return []
  return [
    ...(tree.type === type ? [tree] : []),
    ...find(tree.props?.children, type),
  ]
}

for (const path of layouts) {
  const scope = path.includes("support-dashboard") ? "support" : "dashboard"
  for (const role of ["AGENT", "VIEWER", undefined]) {
    test(`${scope}: ${role ?? "missing role"} never loads channels or receives a setup guide`, async () => {
      const { state, render, access } = fixture(role)
      state.context.activeStore.accessLevel = role
      const tree = await render(path)
      assert.deepEqual(
        state.calls.filter(([name]) => name === "channels"),
        []
      )
      assert.equal(find(tree, "SetupGuide").length, 0)
      assert.equal(find(tree, "DashboardHeader")[0].props.accessLevel, role)
      assert.equal(
        find(tree, "MobileBottomNavigation")[0].props.accessLevel,
        role
      )
      assert.equal(find(tree, "AppSidebar")[0].props.canManageBilling, false)
      assert.equal(
        find(tree, "BillingUsageProvider")[0].props.initialUsage,
        state.usage
      )
      assert.equal(
        access.canAccessDashboardPage("/dashboard/channels", role),
        false
      )
      assert.equal(
        access.canAccessDashboardPage("/dashboard/support", role),
        true
      )
    })
  }
  for (const role of ["OWNER", "ACCOUNT_ADMIN", "STORE_ADMIN"]) {
    test(`${scope}: ${role} retains channel and setup access, with separate billing permissions`, async () => {
      const { state, render } = fixture(role)
      if (role !== "STORE_ADMIN")
        state.billingWorkspaces = [{ id: "workspace-a" }]
      const tree = await render(path)
      assert.deepEqual(
        state.calls.filter(([name]) => name === "channels"),
        [["channels", "store-a"]]
      )
      assert.equal(find(tree, "DashboardHeader")[0].props.accessLevel, role)
      assert.equal(find(tree, "SetupGuide").length, 1)
      assert.equal(
        find(tree, "SetupGuide")[0].props.canManageTeam,
        role !== "STORE_ADMIN"
      )
      assert.equal(
        find(tree, "AppSidebar")[0].props.canManageBilling,
        role !== "STORE_ADMIN"
      )
      assert.equal(
        find(tree, "BillingPaymentIssueShell")[0].props.workspaceId,
        role !== "STORE_ADMIN" ? "workspace-a" : undefined
      )
    })
  }
  test(`${scope}: archived managers have no channel requests, guide or operational mobile tabs`, async () => {
    const { state, render } = fixture("OWNER")
    state.context.activeStore.status = "INACTIVE"
    const tree = await render(path)
    assert.equal(
      state.calls.some(([name]) => name === "channels"),
      false
    )
    assert.equal(find(tree, "SetupGuide").length, 0)
    assert.equal(find(tree, "MobileBottomNavigation").length, 0)
    assert.equal(find(tree, "DashboardHeader")[0].props.isStoreArchived, true)
  })
  test(`${scope}: login and onboarding gates precede store or channel lookups`, async () => {
    for (const [user, status, destination] of [
      [null, { completed: true }, "/login"],
      [{ user: { id: "member" } }, null, "/login"],
      [{ user: { id: "member" } }, { completed: false }, "/onboarding"],
    ]) {
      const { state, render } = fixture("OWNER")
      state.currentUser = user
      state.onboarding = status
      await assert.rejects(render(path), { path: destination })
      assert.deepEqual(state.calls, [])
    }
  })
  test(`${scope}: the selected store role governs the shell even if another store is owned`, async () => {
    const { state, render } = fixture("AGENT")
    state.context.stores.unshift({
      id: "owned-store",
      status: "ACTIVE",
      accessLevel: "OWNER",
    })
    state.billingWorkspaces = [{ id: "managed-account" }]
    const tree = await render(path)
    assert.equal(
      state.calls.some(([name]) => name === "channels"),
      false
    )
    assert.equal(find(tree, "SetupGuide").length, 0)
    assert.equal(find(tree, "DashboardHeader")[0].props.storeId, "store-a")
    assert.equal(find(tree, "DashboardHeader")[0].props.accessLevel, "AGENT")
    assert.equal(find(tree, "AppSidebar")[0].props.canManageBilling, true)
  })
}

test("support remains available without a store; operational dashboard redirects to onboarding", async () => {
  const { state, render } = fixture()
  state.context = { stores: [], activeStore: null }
  const tree = await render(layouts[1])
  assert.equal(find(tree, "BillingUsageProvider")[0].props.storeId, null)
  assert.equal(find(tree, "DashboardHeader")[0].props.accessLevel, undefined)
  assert.equal(find(tree, "SetupGuide").length, 0)
  assert.equal(find(tree, "MobileBottomNavigation").length, 0)
  assert.equal(
    state.calls.some(([name]) => name === "channels" || name === "usage"),
    false
  )
  await assert.rejects(render(layouts[0]), { path: "/onboarding" })
})

test("both shells preserve sidebar cookie, avatar, children and channel-failure fallback", async () => {
  for (const path of layouts) {
    const { state, render } = fixture("OWNER")
    state.channelError = new Error("channel service unavailable")
    for (const [cookie, open] of [
      [undefined, true],
      ["false", false],
      ["true", true],
    ]) {
      state.sidebarCookie = cookie
      const tree = await render(path)
      assert.equal(find(tree, "SidebarProvider")[0].props.defaultOpen, open)
      assert.equal(find(tree, "AppSidebar")[0].props.user.avatarUrl, "avatar")
      assert.equal(
        find(tree, "DashboardHeader")[0].props.syncState,
        "unavailable"
      )
      assert.ok(
        find(tree, "div").some(
          (element) => element.props.children === "page-content"
        )
      )
    }
  }
})
