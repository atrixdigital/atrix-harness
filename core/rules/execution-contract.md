---
name: execution-contract
description: Keeping output, evidence and state coupled to reality — the failure mode that accounts for most agent failures.
source: research-2605.27922
applies: [**]
expires_when: a Harness-Bench rerun shows format violations are no longer a leading failure mode
---

The largest category of agent failure is not bad reasoning. It is **execution drift**: the point
where the reasoning stops being coupled to the actual files, tools, evidence and output contracts.

Measured across 5,194 trajectories, the failures break down as: **output/format contract violations
36.4%**, tool errors without effective recovery 24.6%, incomplete evidence grounding 14.6%, missing
artifact commitment 11.1%, state continuity failures 9.3%. Recovery is covered by
`bounded-recovery`. The other four are this rule.

## Honour the output contract

If a format was specified — by the task, by a role definition, by a schema — **produce exactly
that**. Not a better format you preferred, not the format with an extra helpful section, not prose
where a structure was asked for.

This is the single biggest failure mode in agent work, and it is entirely avoidable: before
finishing, re-read the requested shape and check your output against it field by field.

When no format was specified and the output feeds another agent or a script, **state the shape you
are producing** so the consumer is not guessing.

## Ground every claim in evidence you actually observed

A claim about the system requires a specific observation behind it:

| Claim | Requires |
|---|---|
| "the tests pass" | the command and its output |
| "the endpoint returns 200" | the request you made and the response |
| "this function is unused" | the search or `atrix_impact` result |
| "it renders correctly" | having actually rendered it |

**Never report a result you inferred as one you observed.** If you did not run it, say "not
verified". That is a useful status; a confident guess is not.

## Commit the artifact before declaring done

Work that exists only in your reasoning does not exist. Before reporting completion:

- The file is **written to disk**, not described.
- The change is **saved**, not staged in a plan.
- The output is **at the path you promised**, under the name you promised.

Then verify it landed — read it back, list the directory, check the exit code. "Missing artifact
commitment" means an agent that said it produced something and did not, and it is common enough to
be worth this explicit step.

## Preserve state across boundaries

Anything the next step depends on and cannot re-derive gets written down — a file, not a sentence
in a summary that may be compacted away.

At any handoff — to another agent, another session, or a human — record: what was done, what was
verified and how, what remains, and what is known that is not visible in the code. Long-running
work fails at the seams far more often than in the middle.

## Make obligations legible

Keep the outstanding work visible as you go, rather than reconstructing it at the end. A short
checklist you update beats a recollection you assemble — recollection is where dropped steps hide.
