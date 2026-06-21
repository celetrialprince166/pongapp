---
name: capturing-screenshots
description: Captures visual evidence for the pongapp benchmark — browser screenshots of the running app and AWS console, plus terminal command output rendered as images — and saves them with consistent names into benchmark/docs/assets. Use at any step where visual proof helps the documentation: after a deploy, when the app loads in a browser, when showing AWS console state, dashboards, or terminal output. Pairs with writing-tutorials.
---

# Capturing screenshots

Every meaningful step gets visual proof. This is what makes the submission a
documented, teachable walkthrough rather than a wall of text.

## Where + how to name
Save to `benchmark/docs/assets/`. Naming:
`p<phase>-<platform>-<subject>-<NN>.png`, e.g.
- `p3-ecs-services-running-01.png`
- `p4-eks-ingress-alb-02.png`
- `p5-eks-pod-recovery-03.png`
Use `ecs`, `eks`, or `local` for `<platform>`; `common` when platform-agnostic.

## Browser / app / AWS console captures
Use the Chrome automation tools (load via ToolSearch:
`mcp__claude-in-chrome__tabs_context_mcp,navigate,computer,read_page,tabs_create_mcp`).
1. `tabs_context_mcp` first; create a NEW tab — never reuse a prior session's tab.
2. Navigate to the ALB URL / console page; wait for load.
3. Capture with `computer` (screenshot action); save into assets with the name above.
4. For multi-step flows the user will review, use `gif_creator` and capture a few
   extra frames before/after each action for smooth playback.
Avoid clicking anything that triggers a JS alert/confirm dialog — it blocks the
extension (see project browser rules).

## Terminal output captures
Prefer **rich-codex** for crisp, readable command screengrabs:
```bash
pip install rich-codex
# embed images by writing the command in a fenced block tagged for rich-codex,
# or: rich-codex --no-confirm   # scans markdown and generates images alongside
```
Fallback: paste the raw command + output in a fenced code block in the tutorial
(still valuable; not every step needs an image).

## What to always capture per phase
- The "it works" moment (app in browser via the live URL).
- The control-plane view (ECS console services / `kubectl get all`).
- The networking proof (ALB target health / Ingress ADDRESS / Cloud Map).
- For resiliency: before / during / after the kill.

## Workflow
```
- [ ] 1. Identify the 3–5 shots that prove this phase worked.
- [ ] 2. Capture browser/console shots via Chrome tools.
- [ ] 3. Capture key terminal output (rich-codex or fenced blocks).
- [ ] 4. Save to benchmark/docs/assets with the naming convention.
- [ ] 5. Hand the file list to writing-tutorials for embedding.
```

## Done when
The phase's key moments are saved as named assets ready to embed in the tutorial.
