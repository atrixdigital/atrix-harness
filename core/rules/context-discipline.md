---
name: context-discipline
description: How to spend context — just-in-time retrieval, handoffs between agents, and what to keep out of the window.
source: founding
applies: [**]
---

Context is the scarcest resource in the loop. Spend it on reasoning, not on rediscovery.

## Retrieve just in time

Keep lightweight identifiers — file paths, symbol names, queries — and load the content when you
need it. Do not front-load a repo into the window "so it's there".

Order: **graph query → grep → targeted read → whole file.** Each step is an order of magnitude more
expensive than the last. Pre-indexed graphs cut tool calls by roughly 70% precisely because most
file reads are rediscovering structure an index already holds.

## Offload to the filesystem

Anything you will need later and cannot hold: write it to a file. Notes, intermediate results,
findings, plans. The filesystem is durable memory that survives compaction and can be handed to
another agent.

## Hand off through files, not conversation

When one agent's work feeds another's, write a structured artefact and pass the path. File-based
handoff measurably beats conversational handoff — the handoff point is explicit, and nothing is
lost to summarisation.

A handoff document names: what was done, what was verified and how, what remains, and what the next
agent needs to know that isn't in the code.

## Delegate to keep the main window clean

Broad exploration belongs in a subagent that returns conclusions, not file dumps. The lead agent
should receive an answer, not a transcript.

## Before context runs out

Do not push through a filling window hoping to finish. Write the handoff, then continue fresh.
Work done in the last 5% of a context window is reliably the worst work in the session.
