---
name: writing-tutorials
description: Writes the end-to-end, learning-oriented documentation for the pongapp benchmark — one Medium/blog-quality tutorial chapter per phase, embedding the captured screenshots, explaining every command and the reasoning behind each architectural choice. Use when finishing a phase or any teachable step, when documenting how/why something was built, or when assembling the project writeup. Pairs with capturing-screenshots.
---

# Writing tutorials

The user is learning by doing and must be able to reproduce and explain every
step. Each phase produces one chapter that teaches, not just records.

## Where
`benchmark/docs/` — one file per phase:
`01-containerize.md`, `02-terraform-infra.md`, `03-ecs-fargate.md`,
`04-eks.md`, `05-resiliency.md`, `06-benchmark-report.md`.
Keep a `benchmark/docs/README.md` index linking all chapters in order.

## Chapter template
```markdown
# Phase N — <Title>

## Goal
One paragraph: what we build here and why it matters for the benchmark.

## Prerequisites
What must be done first (prior phase outputs, tools, credentials).

## Concepts (the "why")
Brief explanation of the key idea(s) — e.g. why Cloud Map over internal ALB,
why EBS CSI for the StatefulSet. 2–4 short paragraphs. This is the teaching part.

## Steps
Numbered steps. Each step: the command (fenced), what it does in one line, and the
screenshot proving the result.
\```bash
<command>
\```
![what this shows](assets/pNN-platform-subject-01.png)

## Verification
How we proved it works (the check + its evidence).

## Troubleshooting
Real issues hit and how they were fixed (gold for learning — never skip).

## Cost & teardown
What this phase costs while running and the exact command to tear it down.

## Key takeaways
3–5 bullets the reader should remember.
```

## Writing rules
- **Explain the why, not just the how.** Every non-obvious choice gets a sentence
  of rationale and its trade-off.
- **Reproducible.** A reader following the chapter top-to-bottom should get the
  same result. No undocumented manual console steps.
- **Embed real evidence** from `capturing-screenshots`, not placeholders.
- **Plain, human voice.** Avoid filler and AI-tells; write like an engineer
  teaching a colleague. (The `humanize` skill can polish a final draft.)
- **Keep ECS and EKS parallel** so the reader can compare them directly.
- **Diagrams** where they help (Mermaid is fine for topology/flow).

## Workflow
```
- [ ] 1. Confirm the phase actually works (don't document broken state).
- [ ] 2. Pull the asset list from capturing-screenshots.
- [ ] 3. Draft the chapter from the template; fill Concepts + Troubleshooting.
- [ ] 4. Embed screenshots at the right steps.
- [ ] 5. Add cost + teardown + takeaways.
- [ ] 6. Link it in benchmark/docs/README.md and update AGENTS.md §3 status.
```

## Done when
The chapter is reproducible end-to-end, explains the reasoning, embeds real
evidence, and is linked from the docs index.
