const assert = require("node:assert/strict");
const { randomBytes, createHmac } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("/app/dist/src/generated/prisma/client");

const url = new URL(process.env.DATABASE_URL);
assert.equal(process.env.LOCAL_E2E, "true");
assert.equal(process.env.NODE_ENV, "development");
assert.equal(url.hostname, "postgres");
assert.equal(url.pathname, "/core_e2e");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString() }),
});
const origin = "http://localhost:13001";
const results = [];
async function scenario(name, run) {
  try {
    await run();
    results.push({ name, status: "passed" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "failed", error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
async function request(
  path,
  cookie,
  { status = 200, method = "GET", body, headers = {}, web = false } = {},
) {
  const response = await fetch(
    `${web ? "http://frontend:3000" : "http://backend:4001"}${path}`,
    {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { "Content-Type": "application/json", origin } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const text = await response.text();
  assert.ok(
    [].concat(status).includes(response.status),
    `${method} ${path}: expected ${status}, got ${response.status}; ${text.slice(0, 200)}`,
  );
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { response, text, data };
}
async function session(user) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 3600000) },
  });
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update(token)
    .digest("base64");
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}
async function run() {
  const owner = await db.user.findUniqueOrThrow({
    where: { email: "elif.yilmaz@demo.coreasistan.local" },
  });
  const other = await db.user.findUniqueOrThrow({
    where: { email: "selin.demir@demo.coreasistan.local" },
  });
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { ownerId: owner.id },
  });
  const store = await db.store.findFirstOrThrow({
    where: { workspaceId: workspace.id },
    orderBy: { id: "asc" },
  });
  const question = await db.productQuestion.findFirstOrThrow({
    where: { storeId: store.id },
  });
  const admin = await db.user.create({
    data: {
      name: "E2E Admin",
      email: "admin@e2e.example.invalid",
      emailVerified: true,
      onboardingCompletedAt: new Date(),
    },
  });
  const viewer = await db.user.create({
    data: {
      name: "E2E Viewer",
      email: "viewer@e2e.example.invalid",
      emailVerified: true,
      onboardingCompletedAt: new Date(),
    },
  });
  await db.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: viewer.id, role: "MEMBER" },
  });
  await db.storeMember.create({
    data: { storeId: store.id, userId: viewer.id, role: "VIEWER" },
  });
  const cookies = {
    owner: await session(owner),
    other: await session(other),
    admin: await session(admin),
    viewer: await session(viewer),
  };

  await scenario("readiness responds with healthy dependencies", async () => {
    await request("/health/ready");
  });
  await scenario("anonymous private API requests are rejected", async () => {
    await request("/stores", null, { status: 401 });
  });
  await scenario(
    "real Better Auth resolves the signed fixture session",
    async () => {
      const { data } = await request("/api/auth/get-session", cookies.owner);
      assert.equal(data.user.id, owner.id);
    },
  );
  await scenario("a forged session signature is rejected", async () => {
    await request("/stores", "better-auth.session_token=invalid.signature", {
      status: 401,
    });
  });
  await scenario(
    "store listing only contains the current workspace",
    async () => {
      const { data } = await request("/stores", cookies.owner);
      assert.ok(Array.isArray(data) && data.length > 0);
      const expected = await db.store.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true },
      });
      assert.deepEqual(
        data.map((s) => s.id).sort(),
        expected.map((s) => s.id).sort(),
      );
    },
  );
  await scenario("another customer cannot read this store", async () => {
    await request(`/stores/${store.id}`, cookies.other, { status: [403, 404] });
  });
  await scenario("another customer cannot read questions", async () => {
    await request(`/stores/${store.id}/questions`, cookies.other, {
      status: [403, 404],
    });
  });
  await scenario("catalog returns seeded products", async () => {
    const { data } = await request(
      `/stores/${store.id}/catalog/products`,
      cookies.owner,
    );
    assert.ok(Array.isArray(data.items) && data.items.length > 0);
    const ids = data.items.map((p) => p.id);
    assert.equal(
      await db.product.count({ where: { storeId: store.id, id: { in: ids } } }),
      ids.length,
    );
  });
  await scenario("question detail resolves for its owner", async () => {
    const { data } = await request(
      `/stores/${store.id}/questions/${question.id}`,
      cookies.owner,
    );
    assert.ok(JSON.stringify(data).includes(question.id));
  });
  await scenario("VIEWER cannot send an answer", async () => {
    await request(
      `/stores/${store.id}/questions/${question.id}/answer`,
      cookies.viewer,
      { method: "POST", body: { answer: "Yerel test yaniti." }, status: 403 },
    );
  });
  await scenario("VIEWER cannot request an AI draft", async () => {
    await request(
      `/stores/${store.id}/questions/${question.id}/draft`,
      cookies.viewer,
      { method: "POST", body: {}, status: 403 },
    );
  });
  await scenario(
    "profile edit persists through HTTP and database",
    async () => {
      await request("/users/me", cookies.owner, {
        method: "PATCH",
        body: { name: "E2E Owner Updated" },
      });
      assert.equal(
        (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).name,
        "E2E Owner Updated",
      );
      assert.ok(
        (await request("/users/me", cookies.owner)).text.includes(
          "E2E Owner Updated",
        ),
      );
    },
  );
  await scenario("invalid profile payload is rejected", async () => {
    await request("/users/me", cookies.owner, {
      method: "PATCH",
      body: { name: "", admin: true },
      status: 400,
    });
  });
  await scenario("customer cannot access admin API", async () => {
    await request("/admin/announcements", cookies.owner, { status: 403 });
  });
  await scenario("admin mutation rejects an untrusted origin", async () => {
    await request("/admin/announcements/preview", cookies.admin, {
      method: "POST",
      body: {
        title: "Test",
        message: "Local test",
        roles: ["OWNER"],
        sendEmail: false,
      },
      headers: { origin: "https://attacker.example.invalid" },
      status: 403,
    });
  });
  await scenario(
    "role-targeted announcement publishes once and persists notifications",
    async () => {
      const { data: preview } = await request(
        "/admin/announcements/preview",
        cookies.admin,
        {
          method: "POST",
          status: 201,
          body: {
            title: "E2E owner announcement",
            message:
              "Only owner accounts should receive this local announcement.",
            roles: ["OWNER"],
            sendEmail: false,
          },
        },
      );
      assert.ok(preview.recipientCount > 0);
      await request(
        `/admin/announcements/${preview.id}/publish`,
        cookies.admin,
        { method: "POST", body: {} },
      );
      await request(
        `/admin/announcements/${preview.id}/publish`,
        cookies.admin,
        { method: "POST", body: {} },
      );
      const rows = await db.notification.findMany({
        where: { entityId: preview.id, type: "ADMIN_ANNOUNCEMENT" },
      });
      assert.equal(rows.length, preview.recipientCount);
      assert.equal(
        new Set(rows.map((r) => r.recipientUserId)).size,
        rows.length,
      );
      assert.ok(rows.some((r) => r.recipientUserId === owner.id));
      assert.ok(
        !rows.some((r) => [viewer.id, admin.id].includes(r.recipientUserId)),
      );
      assert.equal(
        await db.emailDeliveryRecord.count({
          where: { subject: "E2E owner announcement" },
        }),
        0,
      );
      assert.ok(
        (await request("/notifications", cookies.owner)).text.includes(
          "E2E owner announcement",
        ),
      );
      const notification = rows.find((r) => r.recipientUserId === owner.id);
      await request(`/notifications/${notification.id}/read`, cookies.owner, {
        method: "PATCH",
        body: {},
      });
      assert.ok(
        (
          await db.notification.findUniqueOrThrow({
            where: { id: notification.id },
          })
        ).readAt,
      );
    },
  );
  await scenario(
    "email switch without provider configuration fails explicitly",
    async () => {
      await request("/admin/announcements/preview", cookies.admin, {
        method: "POST",
        status: 400,
        body: {
          title: "No provider",
          message: "Local email configuration failure test",
          roles: ["OWNER"],
          sendEmail: true,
        },
      });
    },
  );
  await scenario(
    "support journey preserves private notes and customer isolation",
    async () => {
      const { data: ticket } = await request(
        "/support/tickets",
        cookies.owner,
        {
          method: "POST",
          status: 201,
          body: {
            storeId: store.id,
            category: "OTHER",
            impact: "QUESTION",
            subject: "Local E2E support request",
            message:
              "A local synthetic support request for the acceptance test.",
          },
        },
      );
      assert.ok(ticket.id);
      await request(`/support/tickets/${ticket.id}`, cookies.other, {
        status: 404,
      });
      await request(
        `/admin/support/tickets/${ticket.id}/messages`,
        cookies.admin,
        {
          method: "POST",
          status: 201,
          body: {
            message: "E2E private internal note",
            visibility: "INTERNAL",
          },
        },
      );
      await request(
        `/admin/support/tickets/${ticket.id}/messages`,
        cookies.admin,
        {
          method: "POST",
          status: 201,
          body: { message: "E2E public admin reply", visibility: "PUBLIC" },
        },
      );
      const customer = await request(
        `/support/tickets/${ticket.id}`,
        cookies.owner,
      );
      assert.ok(customer.text.includes("E2E public admin reply"));
      assert.ok(!customer.text.includes("E2E private internal note"));
      await request(`/support/tickets/${ticket.id}/messages`, cookies.owner, {
        method: "POST",
        status: 201,
        body: { message: "E2E customer follow-up" },
      });
      await request(`/support/tickets/${ticket.id}/status`, cookies.owner, {
        method: "PATCH",
        body: { action: "RESOLVE" },
      });
      assert.equal(
        (await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }))
          .status,
        "RESOLVED",
      );
      await request(`/support/tickets/${ticket.id}/status`, cookies.owner, {
        method: "PATCH",
        body: { action: "REOPEN" },
      });
      assert.notEqual(
        (await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }))
          .status,
        "RESOLVED",
      );
    },
  );
  await scenario("billing summary is isolated between customers", async () => {
    await request(`/workspaces/${workspace.id}/billing/summary`, cookies.owner);
    await request(
      `/workspaces/${workspace.id}/billing/summary`,
      cookies.other,
      { status: [403, 404] },
    );
  });
  for (const route of ["/", "/login", "/contact"])
    await scenario(`public SSR ${route}`, async () => {
      const { text } = await request(route, null, { web: true });
      assert.ok(text.includes("</html>"));
      assert.ok(!text.includes("Application error:"));
    });
  for (const route of [
    "/dashboard",
    "/dashboard/inbox",
    "/dashboard/catalog/products",
    "/dashboard/catalog/inventory",
    "/dashboard/team",
    "/dashboard/settings/profile",
    "/dashboard/settings/notifications",
    "/dashboard/support",
  ])
    await scenario(`owner SSR ${route}`, async () => {
      const { text } = await request(route, cookies.owner, { web: true });
      assert.ok(text.includes("</html>"));
      assert.ok(!text.includes("NEXT_REDIRECT"));
      assert.ok(!text.includes("Application error:"));
      assert.ok(text.includes("E2E Owner Updated"));
    });
  for (const route of [
    "/admin",
    "/admin/customers",
    "/admin/announcements",
    "/admin/emails",
    "/admin/support",
  ])
    await scenario(`admin SSR ${route}`, async () => {
      const { text } = await request(route, cookies.admin, { web: true });
      assert.ok(text.includes("</html>"));
      assert.ok(!text.includes("NEXT_REDIRECT"));
      assert.ok(!text.includes("Application error:"));
      assert.ok(text.includes("E2E Admin"));
    });
  await scenario(
    "anonymous dashboard does not render private content",
    async () => {
      const { text, response } = await request("/dashboard", null, {
        web: true,
        status: [200, 307, 308],
      });
      assert.ok((response.headers.get("location") || text).includes("/login"));
      assert.ok(!text.includes("E2E Owner Updated"));
    },
  );
  await scenario("logout invalidates the server-side session", async () => {
    await request("/api/auth/sign-out", cookies.owner, {
      method: "POST",
      body: {},
    });
    await request("/stores", cookies.owner, { status: 401 });
  });
}
run()
  .catch((error) => {
    results.push({
      name: "fixture/setup",
      status: "failed",
      error: error.message,
    });
    console.error(error.message);
  })
  .finally(async () => {
    await db.$disconnect();
    const report = {
      date: new Date().toISOString(),
      scope:
        "Real HTTP + SSR with synthetic DB sessions; no browser JS or external OAuth/providers",
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
    writeFileSync(
      "/app/e2e-results/report.json",
      JSON.stringify(report, null, 2),
    );
    if (report.failed) process.exitCode = 1;
  });
