# Next release: extra steps

One-off steps the next release needs on top of the normal flow in
[releasing.md](releasing.md). The `rodge-release` skill requires working
through this file. Do every step in order, and check each one's **Verify**
before moving on. A step that fails or can't be done blocks the release;
tell Shawn instead of skipping it.

After the release, open a PR that removes the finished steps (leave the
heading and intro so the file stays in place for the next release).

Adding steps: any PR whose release needs something beyond deploying adds a
section here in that PR (see AGENTS.md → Releases), in this form:

```md
## <what> (#<PR>)

- When: before / after the Convex deploy, the website deploy, or the phone build
- Commands: ...
- Verify: ...
```
