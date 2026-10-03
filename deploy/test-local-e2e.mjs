// Isolated HTTP/SSR journeys; never loads application .env or provider secrets.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const project = `core-e2e-${randomBytes(5).toString("hex")}`;
const directory = resolve(root, ".ops-test", project);
mkdirSync(directory, { recursive: true });
const path = (value) => resolve(root, value).replaceAll("\\", "/");
const dbPassword = randomBytes(24).toString("hex");
const environment = {
  NODE_ENV: "development",
  LOCAL_E2E: "true",
  PORT: "4001",
  DATABASE_URL: `postgresql://postgres:${dbPassword}@postgres:5432/core_e2e`,
  REDIS_URL: "redis://redis:6379/0",
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  INTEGRATION_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
  BETTER_AUTH_URL: "http://localhost:14001",
  FRONTEND_URL: "http://localhost:13001",
  GOOGLE_CLIENT_ID: "local-e2e-only",
  GOOGLE_CLIENT_SECRET: "local-e2e-only",
  ADMIN_EMAILS: "admin@e2e.example.invalid",
  PADDLE_ENV: "sandbox",
  CATALOG_CONNECTOR_MODE: "mock",
  QUESTION_CONNECTOR_MODE: "mock",
  BILLING_TEST_LIMITS_ENABLED: "false",
  LOG_FORMAT: "json",
  LOG_LEVEL: "warn",
};
// Keep production's HTTPS guard intact; only this generated localhost test build uses HTTP.
const dockerfile = readFileSync(resolve(root, "frontend/Dockerfile"), "utf8");
const httpDockerfile = dockerfile.replace(
  /RUN node -e[^\n]*\\\r?\n\s*&& npm run build/,
  "RUN npm run build",
);
if (httpDockerfile === dockerfile)
  throw new Error("Frontend Dockerfile changed; review localhost build setup.");
writeFileSync(resolve(directory, "frontend.Dockerfile"), httpDockerfile);
const backend = {
  image: `${project}-backend`,
  build: { context: path("backend") },
  environment,
  networks: ["isolated"],
  init: true,
};
const config = {
  services: {
    postgres: {
      image: "postgres:16-alpine",
      environment: { POSTGRES_PASSWORD: dbPassword, POSTGRES_DB: "core_e2e" },
      networks: ["isolated"],
      volumes: ["postgres_data:/var/lib/postgresql/data"],
      healthcheck: {
        test: ["CMD-SHELL", "pg_isready -U postgres -d core_e2e"],
        interval: "2s",
        timeout: "3s",
        retries: 30,
      },
    },
    redis: {
      image: "redis:7-alpine",
      networks: ["isolated"],
      healthcheck: {
        test: ["CMD", "redis-cli", "ping"],
        interval: "2s",
        timeout: "3s",
        retries: 30,
      },
    },
    backend: {
      ...backend,
      ports: ["127.0.0.1:14001:4001"],
      healthcheck: {
        test: [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:4001/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ],
        interval: "3s",
        timeout: "4s",
        retries: 30,
      },
    },
    frontend: {
      image: `${project}-frontend`,
      build: {
        context: path("frontend"),
        dockerfile: path(`${directory}/frontend.Dockerfile`),
        args: {
          NEXT_PUBLIC_API_URL: "http://localhost:14001",
          NEXT_PUBLIC_PADDLE_ENV: "sandbox",
          NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
        },
      },
      environment: { API_URL: "http://backend:4001" },
      networks: ["isolated"],
      ports: ["127.0.0.1:13001:3000"],
      healthcheck: {
        test: [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ],
        interval: "3s",
        timeout: "4s",
        retries: 30,
      },
    },
    runner: {
      ...backend,
      profiles: ["test"],
      volumes: [
        `${path("deploy/e2e")}:/app/e2e:ro`,
        `${path(directory)}:/app/e2e-results`,
      ],
      command: ["e2e/http-scenarios.cjs"],
    },
  },
  networks: { isolated: { internal: true } },
  volumes: { postgres_data: {} },
};
writeFileSync(
  resolve(directory, "compose.json"),
  JSON.stringify(config, null, 2),
  { mode: 0o600 },
);
writeFileSync(
  resolve(directory, "compose.env"),
  "# No application environment loaded\n",
);
const base = [
  "compose",
  "--env-file",
  resolve(directory, "compose.env"),
  "-p",
  project,
  "-f",
  resolve(directory, "compose.json"),
];
function compose(args, log) {
  const result = spawnSync("docker", [...base, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 20 * 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  writeFileSync(resolve(directory, log), output);
  if (result.error || result.status !== 0)
    throw new Error(
      `${args.join(" ")} failed. Log: ${resolve(directory, log)}\n${output.slice(-5000)}`,
    );
  console.log(`${args.join(" ")}: passed`);
}
console.log(`Local HTTP/SSR E2E: ${project}\nLogs: ${directory}`);
try {
  compose(["config", "--quiet"], "config.log");
  compose(["build", "backend"], "build-backend.log");
  compose(["build", "frontend"], "build-frontend.log");
  compose(["up", "-d", "--wait", "postgres", "redis"], "services.log");
  compose(
    [
      "run",
      "--rm",
      "--no-deps",
      "backend",
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
    ],
    "migrations.log",
  );
  compose(
    [
      "run",
      "--rm",
      "--no-deps",
      "backend",
      "dist/src/scripts/seed-realistic-demo.js",
    ],
    "seed.log",
  );
  compose(["up", "-d", "--wait", "backend", "frontend"], "startup.log");
  compose(["run", "--rm", "--no-deps", "runner"], "scenarios.log");
  console.log(readFileSync(resolve(directory, "report.json"), "utf8"));
} finally {
  try {
    compose(["logs", "--no-color", "backend", "frontend"], "application.log");
  } finally {
    compose(
      ["down", "--volumes", "--remove-orphans", "--rmi", "local"],
      "cleanup.log",
    );
  }
}
