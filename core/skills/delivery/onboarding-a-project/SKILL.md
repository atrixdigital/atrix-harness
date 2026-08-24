---
name: onboarding-a-project
description: >
  Bring a repository into the Atrix workspace and make it usable by any agent — scaffold
  it, fill in what only reading the code can tell you, index it, and check its config. Use
  when someone clones a repo into projects/, says they have added or want to add a
  project, asks you to set one up, or when a project under projects/ has no AGENTS.md.
group: delivery
---

# Onboarding a project

A developer should be able to clone a repo and say *"set this up"*. Everything below is yours
to do — none of it needs them to run a command.

The scaffold is the cheap part. **The value is what only reading the code can produce**, and that
is precisely what a human running `atrix init` alone does not get.

## 1. Confirm where it lives

Projects belong at `projects/<name>` in the workspace, each an independent git repo. If the
repository is not there yet, clone it there — do not work on a repo outside the workspace and
expect the graph tools to see it.

```bash
git clone <url> projects/<name>
```

## 2. Scaffold

```bash
cd projects/<name> && atrix init
```

This writes `AGENTS.md` and `UNDERSTANDINGS.md` **into that project's own repo**, so they are
committed there and travel with the code. It never overwrites either if they already exist — if
the project has its own `AGENTS.md`, keep it and add to it.

## 3. Fill in what the template leaves blank — this is the actual work

The scaffold leaves `Stack`, `Commands` and `Gotchas` empty because only the repo can answer them.
Read it and fill them in:

| Section | Where to find it |
|---|---|
| **Stack** | `package.json` dependencies, lockfile, `tsconfig.json`, a Dockerfile, `prisma/` or `migrations/` |
| **Commands** | `package.json` scripts — take the real names, not the ones you would expect. `npm run type-check` and `npm run typecheck` are both common and only one of them exists here |
| **Gotchas** | The README's troubleshooting section, comments marked TODO or HACK near config, and anything in CI that looks like a workaround |

Write what is **true of this repo**, not what is true of repos generally. "Uses Next.js" is
worthless; "App Router, `runtime = 'nodejs'` required on anything touching Prisma" is not.

If you cannot determine something, leave the comment in place rather than guessing. A confidently
wrong command in `AGENTS.md` is worse than a blank line — someone will run it.

## 4. Index and check the config

```bash
atrix index --project <name>
atrix env --project <name>
```

The env audit is not optional. It catches the failure that recurs across these repos: the same
variable defined in two files with different values, so whichever file a tool happens to load
decides which database it talks to. Report anything it finds **before** running any command that
writes.

## 5. Record what you learned finding all that out

While reading the repo you will work out mechanisms the code does not state — why a second cron
exists, which two tables must be written in order, what a workaround is working around. That goes
in the project's `UNDERSTANDINGS.md` with a date, a confidence level and where it came from.

Do this now, while you have it. Nobody reconstructs it later; they re-derive it.

## 6. Verify, then report

Run the typecheck and test commands you just wrote down. If they do not work, you have recorded
the wrong ones — fix them rather than leaving a manual that lies.

Report: what the project is, its stack, the commands, anything the env audit found, and what you
recorded as understandings.

## Doing this without being asked

If a project under `projects/` has no `AGENTS.md`, it has not been onboarded. Say so and offer —
the session-start hook flags it, but the person may not have read that line.
