---
name: safety
description: What requires human confirmation, what is never done unprompted, and how to treat secrets and production.
source: founding
applies: [**]
---

## Confirm first — always

Anything **outward-facing** or **hard to reverse**:

- Deploying, publishing, releasing
- Pushing to a shared or default branch
- Sending messages, emails, or anything a third party will receive
- Changing prices, plans, or anything billing-facing
- Deleting or overwriting data, branches, or files you did not create
- Submitting to an app store or review process

Approval in one context does not carry to the next. "Yes, deploy staging" is not "yes, deploy prod".

## Secrets

- Never commit a secret. Never print `.env*` contents into output, a log, or a report.
- Never send repository contents, credentials, or customer data to an external service.
- If you need a value from a `.env` file, read the **key names** and ask the human for the value,
  or reference it by name without resolving it.

## Production

Treat anything carrying `prod` or `production` as a whole word or name segment as protected:
databases, namespaces, branches, config files, deploy targets.

- Never run a migration against a live database without explicit, specific confirmation.
- Never use `migrate dev` (or equivalent destructive migration commands) against a hosted database.
- Prefer a dry run, a diff, or a read-only query first, and show it before acting.

## Before you delete or overwrite

Look at the target first. Read the file, list the directory, check what the branch contains.
"I assumed it was empty" is not a defence you get to use twice.

## Destructive commands

`rm -rf`, `git reset --hard`, `git push --force`, `DROP`, `TRUNCATE`, `kubectl delete` — state what
will be lost before running, and get a yes.
