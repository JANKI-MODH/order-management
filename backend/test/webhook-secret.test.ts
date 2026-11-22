import assert from "node:assert/strict";
import { test } from "node:test";
import { webhookSecretMatches } from "../src/oms/webhook-secret.ts";

const secret = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";

test("a matching private webhook secret is accepted", () => {
  assert.equal(webhookSecretMatches(secret, secret), true);
});

test("a different secret of the same length is rejected", () => {
  assert.equal(webhookSecretMatches("b".repeat(32), secret), false);
});

test("the example secret is rejected even when both sides match", () => {
  const example = "change-me-to-a-long-random-string";
  assert.equal(webhookSecretMatches(example, example), false);
});

test("a short or empty secret is rejected", () => {
  assert.equal(webhookSecretMatches("short-secret", "short-secret"), false);
  assert.equal(webhookSecretMatches("", secret), false);
});
