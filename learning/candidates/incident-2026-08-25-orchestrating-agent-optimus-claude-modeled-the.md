---
incident: incident-2026-08-25-orchestrating-agent-optimus-claude-modeled-the
title: Orchestrator invented a domain model instead of confirming it with the user
status: proposed
---

## The generalisation

For a brand-new domain with no existing codebase, "never guess at architecture" has no code or
graph to fall back on — the only source of truth is the user's own head, and a short product
description is not sufficient grounding to invent an entity/role model from. This generalizes past
this one incident: any planner-role work (or an orchestrator acting as one) writing a schema-first
spec for a greenfield domain is exposed to the same failure, regardless of repo.

## Who this bites

Any agent acting in the `planner` role (or performing planner-equivalent work while orchestrating,
as happened here) on a **greenfield** feature/project — one with no existing code to read entities
from. Does not apply once a domain has real code/schema already in the repo; at that point "read
the code, query the graph" is the correct and sufficient instruction. Shared harness rule, not
repo-specific — this exact failure mode is available on any new project in any repo under the
harness.

## Proposed change

Target: `core/rules/confirm-domain-before-modeling.md` (new file)

```diff
+++ core/rules/confirm-domain-before-modeling.md
+---
+name: confirm-domain-before-modeling
+description: For a brand-new domain with no existing code to read, confirm the entity/actor list with the user before writing a schema-first spec or dispatching implementation.
+source: incident-2026-08-25-orchestrating-agent-optimus-claude-modeled-the
+applies: [planner, "**"]
+---
+
+`system-design.md`'s "data first" and this manual's "never guess at architecture" both assume
+there is something to read — existing code, a graph, prior art. **A brand-new domain has none of
+that.** The only source of truth is the user's own head, and a short product description ("esports
+ hospitality") is not enough to derive a correct entity model from — no matter how internally
+consistent the invented one turns out to be.
+
+## The rule
+
+Before writing a schema-first spec (`SPEC.md`, an ADR, a migration) for a domain with **no existing
+codebase to derive entities from**, enumerate the proposed entities, actors, and roles back to the
+user and get explicit confirmation — before any implementation is dispatched, not after.
+
+One generic scoping question early in the conversation ("what is this product?") does not satisfy
+this. The specific nouns you are about to commit to code — the roles, the aggregates, the thing
+being booked/created/owned — must be named back to the user for confirmation.
+
+## Why this is a rule and not a suggestion
+
+Plausibility is not evidence of correctness for domain modeling. An invented model can be
+internally consistent, pass every review checklist, and still be entirely wrong — because the
+failure is not in the code, it is in a fact about the business that only the domain owner holds.
+This class of mistake is expensive precisely because it is invisible until someone who knows the
+real domain looks at the output: by then, implementation (schema, services, UI) has already been
+built and verified against the wrong nouns.
+
+## How we would know it stopped mattering
+
+If greenfield planning work consistently surfaces its entity list for confirmation before
+implementation — without being told to — this rule is dead scaffolding and can be pruned.
```

## Why this earns its place

The cost it prevents is not a typo or a lint failure — it's a full parallel implementation
(2 build tracks, ~250 combined tool calls, real DB-backed TDD, real Playwright verification) built
correctly against the wrong domain, discovered only after the fact. The rule itself costs a few
lines of context in planner-role sessions and only fires on genuinely greenfield work, which is
infrequent relative to the harness's steady-state (editing existing repos with code to read).

## How we would know it stopped mattering

Same condition as stated in the rule file: if greenfield planning consistently surfaces the entity
list for confirmation unprompted — because it's now trained behavior or a stronger planner default
makes this rule redundant — prune it.
