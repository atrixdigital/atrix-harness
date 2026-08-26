---
name: choosing-a-design-direction
description: >
  Pitch two or three complete, distinct design directions and let the human choose before
  any code is written, then pin the winner to a DESIGN.md the build follows. Use when
  starting any new visual surface — a site, a landing or launch page, an app, a product
  UI, a redesign — or when someone says "build me a…" and no design system exists yet.
  Use before writing components, not after.
group: delivery
---

# Choosing a design direction

**The choice happens before the code exists.** Changing a paragraph is free; changing a built page
is a day. And a direction chosen by the person who has to live with it is the one that survives
review.

This is also the documented escape from generated-looking design: not a better adjective, but a
process — derive a direction from the subject, put distinct options side by side, commit to one,
and build from the record.

## When to skip this

**A design system that already exists beats any direction you could pitch.** Inside an existing
product, match it — see `tailwind-theming` for the tokens and `house-style` for which medium gets
the brand.

Skip it too for a single component, a bug fix, or an internal utility whose job is completion
rather than persuasion. Three pitches for a settings toggle wastes everyone's time.

Run it when the surface is **new and has an identity to establish**.

## 1 · Pin the brief first

Before generating anything, state — and get corrected on — three things:

- **Subject.** The concrete thing. Not "a booking site" but "padel court booking in Islamabad".
- **Audience.** Who is looking, and what they already believe.
- **The single job.** What this surface exists to make happen. One sentence.

If the request did not specify them, **choose and state your choice** rather than asking. A named
assumption is easy to correct; an open question stalls.

## 2 · Derive directions from the subject, never from a trend list

This is the part that decides whether the output is distinctive.

**Go to the subject's own world first** — its instruments, materials, vernacular, artefacts, the
things its people actually look at. A peptide supplier has chromatograms, lyophilised vials,
sequences, cold chain. A padel app has court lines, availability grids, scoring. That is where a
direction nobody else could have produced comes from.

**Only then** pick a material treatment that serves it, from
`building-ui/references/design-styles.md`. That file is a palette of techniques, not a menu to
choose from — glass, bento, brutalism and the rest are how a direction gets built, never what it
is. A direction that starts as "let's do glassmorphism" is a trend, and it will read like one.

## 3 · Pitch two or three, and make them genuinely different

Three is the useful number. Two is a false choice; four is a survey.

They must differ in **kind**, not in accent colour. If the difference between your options is a hue,
you have pitched one direction three times.

Each pitch is short enough that all of them fit in one message:

```
A · BENCH READOUT
   The chromatogram is the hero — the trace IS the product claim.
   Palette   paper #F4F7F7 · ink #0E1518 · vermilion #B93E10 · jade #0F6B4F
   Type      Chivo 800 display · Newsreader 300 body · IBM Plex Mono data
   Material  flat, hairline rules, instrument precision
   Signature the live HPLC trace, drawn on load
   Risk      reads clinical; wrong if the brand wants warmth

   ┌──────────────────────────────┐
   │ eyebrow                      │
   │ BIG CLAIM                    │
   │ lede                         │
   │ ┌──────────────────────────┐ │
   │ │   ~~~~~/\~~~~~~~~~~      │ │   ← the trace
   │ └──────────────────────────┘ │
   └──────────────────────────────┘
```

Include the **risk** on each. A pitch with no downside is a pitch nobody can evaluate, and naming
the risk is what makes the human's choice informed rather than aesthetic.

Where the tooling offers a structured choice with previews, use it — the ASCII wireframe is what
makes an option legible before anything is built.

## 4 · Critique before you show

Against each direction, ask: **would I have produced this for any similar brief?** If yes, it is a
default rather than a choice — revise it and say what changed.

The current defaults to check yourself against: cream + serif + terracotta; near-black + one acid
accent; broadsheet hairline rules; purple-to-blue gradient on white; Inter or Space Grotesk;
centred hero over three rounded cards; glass on every surface.

Any of these is right when the brief asks for it. None is a choice when it is simply what came out.

## 5 · Pin the winner to DESIGN.md

**The decision is committed to the repo, not left in the conversation.** A chat message gets
compacted away; the next session then re-derives the direction differently and the product drifts
apart one plausible variation at a time.

```markdown
# Design direction — <product>

Chosen: <name>            Date: <date>            Decided by: <who>

## Brief
Subject · Audience · The one job this surface does

## Tokens
Palette    role → value, as oklch. These become --app-* in globals.css.
Type       display / body / mono, with the weights actually used
Spacing    the scale, and the section rhythm
Radius     one value, and where the exception is

## Signature
The single element this is remembered by, and why it belongs to this subject.

## Motion budget
What animates, what does not, and the one orchestrated moment.

## Deliberately not
The directions rejected, in one line each, and what would make us revisit.
```

The **"deliberately not"** section is the one that earns its keep — it stops the same rejected idea
being re-proposed every quarter, and it tells the next person what was already considered.

Tokens flow straight into `tailwind-theming`'s three-layer structure. `scaffolding-a-web-app`
expects this file to exist before step 2.

## 6 · Build from the record, then check against it

Derive every colour and type decision from `DESIGN.md`. When the build wants something the record
does not have, **update the record** — do not add it inline and move on, or the file stops being
true within a week.

Before calling it done, render it and compare against the pitch — see `verifying-ui-visually`. The
question is not "is this good" but "is this the direction we chose".

## Verify

- The brief is written down, and the human corrected it or let it stand.
- The options differed in kind, and each named its risk.
- `DESIGN.md` exists, is committed, and names what was rejected.
- The built page's tokens match the file, and the signature element is actually there.
