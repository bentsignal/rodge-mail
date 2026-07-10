---
name: refactor
description: User-invoked final review/refactor pass for already-working code, usually in a fresh thread after implementation, commit, push, or PR creation. Do not use proactively during normal implementation. Use only when the user explicitly asks to use the refactor skill, clean up a finished PR, make completed code easier to review, improve React composition, break up monolithic files/components, clarify data flow, avoid prop drilling, introduce feature-scoped state where appropriate, or bring rough finished code up to the user's preferred final code quality without changing intended behavior.
---

# Refactor

## Overview

Use this skill only as a final cleanup and review pass for code that is already working. It is not part of the initial implementation workflow and should not be invoked just because code is being written.

The normal use case is: an implementation is finished, often already committed, pushed, or opened as a PR, and the user starts a separate review thread asking for cleanup. At that point, preserve behavior and refactor for reviewability.

## Invocation Rules

- Do not use this skill proactively during feature implementation.
- Do not mention this skill as a future step unless the user asks for refactor cleanup.
- Do not treat this as a guide for how to write the first draft.
- Use it when the user explicitly asks for a refactor pass, PR cleanup, reviewability cleanup, or to use the `refactor` skill.
- Preserve intended behavior. If a behavior change seems necessary, call it out before or while making it.

## Review Pass

Start by reading the changed files, the PR diff if available, nearby existing patterns, and any user-provided review notes. Existing project code is the source of truth; this skill only points out what to look for.

Work from the review surface inward:
- Make entrypoints, routes, pages, handlers, and feature modules read clearly.
- Split around responsibilities, not line counts.
- Prefer small units with clear names, explicit responsibilities, and local decisions.
- Remove dead code created by the cleanup.
- Avoid abstractions that hide code without improving comprehension.

Use only the references that match the cleanup:
- React or JSX/TSX composition cleanup: read [React Composition](references/react-composition.md).
- If React cleanup calls for a new or changed Rostra store, also read the project-local `rostra` skill.

## Subagent Use

For large PRs, split review cleanup by concern rather than by arbitrary file chunks. Give each subagent:
- The user's quality goal.
- The changed-file list or PR diff.
- The relevant reference file path from this skill.
- A constraint to preserve behavior and avoid unrelated edits.

Ask each subagent to return either a patch or concrete findings. The main agent remains responsible for merging, resolving overlap, running validation, and summarizing the final result.

## Refactor Standards

- Make the top-level flow obvious before polishing details.
- Route/page files should read like a clear overlay of the route: data loading/gates, providers, and the named components that make up the screen should be visible in the route file.
- Do not over-correct by turning route files into one-line wrappers around opaque feature components. If opening the route no longer shows what the page contains, the abstraction went too far.
- Prefer the web `$username` route shape in this repo: route-level data query/load, data passed into the relevant store provider, then a readable in-file outline of the profile/header/list/empty-state composition.
- Prefer feature-local files over dumping unrelated helpers into shared utilities.
- Use existing project conventions before inventing new patterns.
- Keep state ownership clear. A reader should quickly see which store or component owns state, which components consume it, and which functions mutate it.
- Avoid prop drilling for feature state and actions. Prefer a feature-scoped store when multiple nested components need shared state.
- Keep UI components primarily presentational. Component bodies should not accumulate pagination, fetch orchestration, optimistic updates, scroll thresholds, refresh coordination, query construction, or other business rules.
- Extract business logic into named hooks or feature-scoped Rostra stores. Hoist state high enough to cover the feature subtree, then consume it directly in leaf components with `useStore` selectors instead of threading values through intermediate props.
- Use props for true component configuration and composition boundaries, not as a transport layer for shared feature state or actions.
- When a component needs only one piece of state or one action, import the relevant store hook and select that piece locally. Do not pass broad state bags through the tree.
- Keep reusable feature behavior in feature hooks/stores, but keep route-specific composition in the route file when that makes the page easier to understand.
- Keep server and app configuration in the shared config package when the value represents a product or platform rule. Query/mutation files should consume config, not define duplicated limits inline.
- Remove dead code created by the refactor.
- Keep comments rare. Add comments only when code cannot clearly explain the decision.
- Do not turn a cleanup pass into a redesign, framework migration, or broad style rewrite unless explicitly requested.
- Validate using the repository's own instructions. If the repo has no instructions, run the smallest meaningful checks for the touched area.

## Final Summary

Report:
- What was refactored.
- What behavior was preserved.
- What validation ran and whether it passed.
- Any user or unrelated worktree changes intentionally left alone.
