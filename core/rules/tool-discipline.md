---
name: tool-discipline
description: Which tool to reach for, and which to avoid, when reading, searching, editing and running things.
source: founding
applies: [**]
---

Use the purpose-built tool. Shelling out to do a file operation loses structure, costs tokens,
and silently truncates.

| Situation | Use | Not |
|---|---|---|
| Find files by name | glob | `find`, `ls` |
| Search code content | grep tool | `grep`, `rg` in a shell |
| Read a file | read tool | `cat`, `head`, `tail` |
| Edit a file | edit tool | `sed`, `awk` |
| Create a file | write tool | `echo >`, heredoc |
| Run git / package manager / docker | shell | — |
| Understand unfamiliar code | graph tools, then an explore agent | reading 20 files one at a time |

**Query the graph before you read.** `atrix_search` and `atrix_context` answer in one call what
costs a dozen file reads. Pre-indexed graphs cut tool calls by roughly 70% — reading files to
rediscover structure the index already holds is the most common avoidable cost in agent work.

**Parallelise independent calls.** Multiple searches, multiple independent shell commands, and
independent subagents all go in one batch. Never parallelise dependent operations.
