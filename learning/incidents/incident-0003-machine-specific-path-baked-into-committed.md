---
id: incident-0003
title: machine-specific path baked into committed generated output
date: 2026-08-21
status: merged
cost: 10m
---

## What happened

`atrix build` generated the graph MCP config with a resolved absolute path:

```json
"args": ["run", "/Users/moeidsaleem/Desktop/Work/Atrix/atrix-harness/packages/graph-mcp/src/server.ts"]
```

`adapters/` is committed, so this would have shipped one developer's home directory to
everyone. CI would have failed the "adapters are up to date" check on the first run, and any
teammate installing the plugin would have got a path that does not exist on their machine.

Caught by inspection immediately after generating it, before committing.

## Why it happened

The generator had `harnessRoot` in scope and using it was the path of least resistance. The
mistake was not the path — it was **not asking whether the output is committed**. Generated
output that stays local may contain absolute paths; generated output that is committed may not,
because it is consumed on machines that are not the one that produced it.

## What fixed it

Emit `${ATRIX_HOME}` instead of resolving, and let the environment supply the root — which the
README already requires people to set:

```diff
- args: ['run', join(harnessRoot, 'packages', 'graph-mcp', 'src', 'server.ts')],
+ args: ['run', '${ATRIX_HOME}/packages/graph-mcp/src/server.ts'],
```

Plus a build-time guard so this cannot recur silently.

## What the system should learn

**Committed generated output must be machine-independent**, and that property should be checked
by a machine rather than remembered by a person. Absolute paths, hostnames, usernames, timestamps
and locale-dependent formatting all cause the same failure: the artefact works for whoever
generated it and nobody else.

This is the generalisable rule. Related to [incident-0002](incident-0002-adapters-went-stale-because-build-was-not-rerun.md):
both are failure modes of committing generated output, and both are correctly solved by a check
rather than by a rule someone has to recall.

## Proposed change

- [x] A build-time assertion that generated output contains no absolute machine paths
- [ ] New or amended rule in `core/rules/` — not needed; the check enforces it
- [ ] Nothing
