// CI check for every PR (.github/workflows/release-steps.yml). The
// description's Release notes must say:
//
// - "Extra release steps:" none, or what the PR adds to docs/next-release.md
//   (Convex environment variables, DNS or AWS setup, an order to deploy in,
//   checks after shipping). The release agent works through that file, so
//   nothing depends on someone remembering to pass it on.
// - "Convex deploy needed:" yes exactly when the PR changes Convex
//   functions or schema (services/convex/src, tests aside), since releases
//   push them to the one deployment by hand.
// - "Native change:" no or yes. Whether native code changed takes the
//   fingerprint, which the Mobile fingerprint workflow checks.
//
//   PR_BODY="..." BASE_SHA=<sha> node --experimental-strip-types scripts/check-release-steps.ts
import { execFileSync } from "node:child_process";

const CHECKLIST = "docs/next-release.md";
const CONVEX_SOURCE = "services/convex/src/";

function fail(message: string): never {
  console.error(`release steps: ${message}`);
  process.exit(1);
}

const body = process.env.PR_BODY ?? "";
const base = process.env.BASE_SHA;
if (base === undefined || base === "") fail("BASE_SHA is not set");

function lineValue(name: string) {
  const match = new RegExp(`^\\s*-\\s*${name}:(.*)$`, "im").exec(body);
  if (match === null) {
    fail(
      `the description's Release notes need a "- ${name}:" line (see .github/pull_request_template.md).`,
    );
  }
  return (match[1] ?? "").replace(/<!--[\s\S]*?-->/g, "").trim();
}

const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const steps = lineValue("Extra release steps");
if (steps === "") {
  fail(
    '"Extra release steps:" is empty. Write "none", or add the steps to docs/next-release.md and say so.',
  );
}
const addsSteps = changed.includes(CHECKLIST);
const noSteps = /^none\b/i.test(steps);
if (!noSteps && !addsSteps) {
  fail(
    `this PR says it has extra release steps ("${steps}") but doesn't change ${CHECKLIST}. Add them there, with when to do each and how to verify it.`,
  );
}
console.log(
  `extra release steps: ${noSteps ? "none" : steps}${addsSteps ? ` (${CHECKLIST} changed)` : ""}`,
);

const deploy = lineValue("Convex deploy needed");
const saysDeploy = /^yes\b/i.test(deploy);
if (!saysDeploy && !/^no\b/i.test(deploy)) {
  fail('"Convex deploy needed:" must start with "no" or "yes".');
}
const convexChanges = changed.filter(
  (file) =>
    file.startsWith(CONVEX_SOURCE) &&
    !/\.test\.ts$/.test(file) &&
    !file.startsWith(`${CONVEX_SOURCE}_generated/`),
);
if (convexChanges.length > 0 && !saysDeploy) {
  fail(
    `this PR changes Convex functions (${convexChanges.slice(0, 5).join(", ")}${convexChanges.length > 5 ? ", ..." : ""}), so "Convex deploy needed:" must say yes.`,
  );
}
if (saysDeploy && convexChanges.length === 0) {
  fail(
    `"Convex deploy needed:" says yes, but nothing in ${CONVEX_SOURCE} changed. Say no, or list the setup in docs/next-release.md instead.`,
  );
}
console.log(`convex deploy needed: ${deploy}`);

const native = lineValue("Native change");
if (!/^(no|yes)\b/i.test(native)) {
  fail('"Native change:" must start with "no" or "yes".');
}
console.log(`native change: ${native}`);
