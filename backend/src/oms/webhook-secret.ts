import { timingSafeEqual } from "node:crypto";

const exampleSecret = "change-me-to-a-long-random-string";

export function webhookSecretMatches(provided: string, expected: string): boolean {
  if (!expected || expected === exampleSecret || expected.length < 32) {
    return false;
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
