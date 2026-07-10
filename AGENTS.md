# AGENTS.md

## Repository Summary

A focused, AI-native email client for web, Electron desktop, and Expo mobile,
backed by Convex.

## Required Validation After Changes

At the end of every run, run the following commands in order:

1. `pnpm run lint`
2. `pnpm run typecheck`

If all of these succeed, run:

4. `pnpm run format:fix`

Then summarize changes for the user.

## Preferences

- Do **_NOT_** leave excessive comments when writing code. Only leave comments when
  the code itself does not clearly explain what it does
