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

## Import the old Microsoft 365 mail into hosted me@bentsignal.com (#24)

- When: after the Convex deploy. Keep the Microsoft 365 me@bentsignal.com
  account connected in Rodge and its subscription active until the import
  finishes; it reads that account through Graph.
- Needs nothing new: the import uses the existing `HOSTED_MAIL_*` variables
  and Microsoft credentials, and the `rodge-mail-convex` IAM policy already
  allows `s3:PutObject` and `s3:GetObject` on the whole bucket, `import/`
  included. Check it before starting:
  `aws iam get-user-policy --user-name rodge-mail-convex --policy-name rodge-mail-convex`
  should list both actions on `arn:aws:s3:::<bucket>/*`.
- Commands:
  ```sh
  node scripts/hosted-mail.mjs import me@bentsignal.com me@bentsignal.com
  node scripts/hosted-mail.mjs import-status me@bentsignal.com
  ```
  The first address picks the Microsoft account, the second the hosted one.
  Run `import-status` until the status is `completed`. It handles 25 messages
  per batch and slows to one inbox message every 2 s, so a large mailbox can
  take hours. If it ends `failed`, read `last error` (for example, Microsoft
  needs reconnecting), fix that, and run `import` again; it resumes where it
  stopped. If it says `running` but `updated` hasn't moved for 15 minutes, a
  batch died without finishing; run `import` again to resume it.
- Verify: `import-status` shows `completed`, imported plus skipped close to
  the estimated total, and `failed` 0 or only failures whose reasons are
  acceptable (an over-40 MB message, say). On mail.rodgers.dev, open an old
  inbox conversation in the hosted account: your replies sit in the thread
  and an attachment downloads. `aws s3 ls s3://<bucket>/import/ --recursive | wc -l`
  roughly matches the imported count. Until the Microsoft account is removed
  (a separate PR), its synced inbox mail shows up twice.
