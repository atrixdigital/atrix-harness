---
incident: incident-0002
title: adapters went stale because build was not rerun
status: dismissed
---

## The generalisation

Generated output that is committed to the repo will drift from its source, because nothing forces
regeneration and the drift is invisible in review — the diff looks intentional either way.

That is real and general. But **it does not want to be a rule.**

## Who this bites

Any contributor editing `core/`. Which is everyone, eventually.

## Proposed change

Target: ~~`core/rules/`~~ → `.github/workflows/ci.yml`

```yaml
- name: Adapters are up to date
  run: |
    bun run atrix build
    if ! git diff --quiet -- adapters; then
      echo "::error::adapters/ is stale. Run 'bun run atrix build' and commit the result."
      exit 1
    fi
```

## Why this earns its place

It does not — not as a rule.

A rule saying "remember to run `atrix build`" costs context in **every session forever** and works
only when the agent happens to recall it at the right moment. A CI check costs nothing at runtime,
catches every occurrence, and cannot be forgotten.

**When a failure can be caught by a machine, catching it by a machine beats writing it down.** Rules
are for judgement that cannot be automated. This was not that.

The check already exists in `.github/workflows/ci.yml`, added during phase 0.

## How we would know it stopped mattering

If `adapters/` ever stops being committed — served from a build artifact instead — the check and
this incident both become irrelevant.

---

**Kept as the worked example of dismissal.** Most incidents end here, and that is the loop working
correctly, not failing. A rule library grows by refusing things.
