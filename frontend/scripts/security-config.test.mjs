import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"

const require = createRequire(import.meta.url)
const { default: loadConfig } = require("next/dist/server/config.js")
const { PHASE_PRODUCTION_BUILD } = require("next/constants.js")
const {
  hasRemoteMatch,
} = require("next/dist/shared/lib/match-remote-pattern.js")
const config = await loadConfig(PHASE_PRODUCTION_BUILD, process.cwd(), {
  silent: true,
})
const allowed = (url) =>
  hasRemoteMatch(
    config.images.domains,
    config.images.remotePatterns,
    new URL(url)
  )

test("marketplace and Google avatar images remain allowed", () => {
  for (const url of [
    "https://cdn.dsmcdn.com/ty123/product.jpg",
    "https://productimages.hepsiburada.net/s/123/550/123456.jpg",
    ...[3, 4, 5, 6].map(
      (id) => `https://lh${id}.googleusercontent.com/a/profile=s96-c`
    ),
  ])
    assert.equal(allowed(url), true, url)
})

test("optimizer rejects arbitrary hosts, lookalikes, private IPs and alternate ports", () => {
  for (const url of [
    "https://attacker.example/image.avif",
    "https://cdn.dsmcdn.com.attacker.example/image.jpg",
    "https://evilcdn.dsmcdn.com/image.jpg",
    "https://storage.googleapis.com/image.jpg",
    "https://arbitrary.googleusercontent.com/image.jpg",
    "https://127.0.0.1/image.jpg",
    "https://10.0.0.1/image.jpg",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/image.jpg",
    "http://cdn.dsmcdn.com/image.jpg",
    "https://cdn.dsmcdn.com:8443/image.jpg",
    "https://cdn.dsmcdn.com/image.jpg?url=https://attacker.example",
  ])
    assert.equal(allowed(url), false, url)
  assert.equal(config.images.maximumRedirects, 0)
  assert.equal(config.images.dangerouslyAllowLocalIP, false)
})
