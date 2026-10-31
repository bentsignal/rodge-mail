## Summary

<!-- What changed and why, in a few sentences. Note any decisions you made on Shawn's behalf. -->

<!-- Fixing a GitHub issue? Add "Fixes #<issue>" (one line per issue). -->

## Evidence

<!-- Screenshots (before/after for UI changes) and videos for motion, from scripts/evidence.sh. Frame reports (scripts/sim.sh frames) for anything that moves. Never commit them. -->

## Testing

<!-- What you exercised in the simulator or on the web, and the checks you ran. -->

- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck`
- [ ] `pnpm run test`
- [ ] `pnpm run react-doctor --base origin/main` (mobile changes)

## Release notes

- Convex deploy needed: <!-- no / yes: this changes Convex functions or schema (services/convex/src), which the release pushes to dazzling-dog-633 with `pnpm exec convex dev --once`. Say whether the phone's installed build keeps working against it. CI checks this line. -->
- Native change: <!-- no / yes: the native fingerprint changed (native dependencies, config plugins, app.config.ts), so the phone needs a new local EAS build. CI labels these "📱 Native Change" and checks this line. -->
- Extra release steps: <!-- none, or what this PR adds to docs/next-release.md: Convex environment variables, DNS or AWS setup, an order to deploy in, checks after shipping. CI checks this line. -->
