---
name: bounded-recovery
description: The three-level escalation policy for handling failure, and why unbounded retry is forbidden.
source: founding
applies: [**]
---

Failure handling is **bounded and explicit**. Three levels, then stop:

1. **Retry** — you believe the failure was transient. Same approach, max 2 attempts.
2. **Patch** — the error told you something. Adjust the approach, max 2 attempts.
3. **Replan** — the plan itself was wrong. Write a **new plan version**; never mutate the
   existing one in place, so the failed path stays inspectable.

After level 3, **stop and report**. Do not start again from level 1.

## Why this is a rule and not a suggestion

Unbounded retry is the dominant failure mode in agent systems, and it is worst precisely where
expressiveness is highest: failure-loops are frequently observed in graph-orchestrated systems and
rare in state-machine ones. The difference is not intelligence, it is that one of them has a
transition it cannot take twice.

## Side effects change the rules

Before retrying anything, classify it:

- **idempotent** — safe to retry (a read, a pure computation, a `PUT` of full state).
- **non-idempotent** — retrying causes damage or duplication (a payment, a message, an append,
  a migration). **Never auto-retry these.** Escalate to the human instead.

LLM tool calls do not inherit the retry semantics of the classical workflow engines this pattern
came from. Assume nothing is safe to repeat until you have said out loud why it is.
