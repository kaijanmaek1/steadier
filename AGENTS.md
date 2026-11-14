# Steadier team working rules

## Product and source of truth

This repository contains two products: the real-site Edge/Chrome extension in `extension/`, and the sample-feed demo in `dist/`. The extension filters the website locally. It does not control TikTok/Instagram recommendation services, work inside their mobile apps, fact-check videos, or provide clinically validated treatment. Preserve these distinctions in product wording.

Work in this repository. Sibling `steadier-github-upload/` and ZIP files are manual distribution snapshots, not sources of truth. Never edit or synchronise them instead of the working source. Preserve user changes and existing history.

## Project lead and specialist delegation

The primary conversation acts as project lead. The user has requested specialist delegation for Steadier. Use at most **three specialist subagents simultaneously**, plus the lead. Group independent reviews first; assign implementation only after identifying concrete issues. Do not spawn a second project lead unless explicitly requested.

Reusable roles live in `.codex/agents/`:

| Role | Responsibility |
| --- | --- |
| `project_lead` | Scope, priorities, task contracts, integration, evidence and user updates |
| `ui_design` | Layout, visual hierarchy, responsive presentation and consistent styling |
| `ux_usability` | Onboarding, mood/session flows, wording, defaults and recovery from mistakes |
| `interactions` | Panel state, native event handling, dragging, focus and interaction feedback |
| `programming` | Storage, session identity, classifiers, prompts, filtering and site adapters |
| `accessibility_qa` | Keyboard/screen-reader access, contrast, regression checks and test evidence |

Each delegated task must name its scope, deliverable, files it may edit and tests it owns. Agents may review shared files, but only one agent may edit a given file at once. The lead coordinates shared interfaces before edits and assigns a new owner explicitly when handing off. Agents communicate interface changes promptly and do not undo others' work. Use isolated worktrees when available for overlapping changes; do not assume separate conversations are isolated.

## Change workflow

1. Inspect relevant code and current tests. Identify the trigger, actual behaviour and desired result.
2. Keep a prioritised backlog in `docs/IMPROVEMENT_BACKLOG.md`. Distinguish implemented, tested, deferred and blocked work.
3. Implement bounded changes that preserve mood check-ins, filtering/reveal, manual preferences, feedback/likes, prompts, history, export and deletion.
4. Validate session ownership before mutations. Queued or delayed work must never attach old feedback to a new session or restore deleted data.
5. Keep raw captions/comments in memory. Store only documented local session metadata and user-requested prompts; do not add uploads, trackers, secrets or platform permissions without task justification.
6. Treat likes as weak preferences, not improved mood. Describe style estimates as uncertain; serious/informational style is not verified truth. Local English parsing is not a general AI model.
7. Preserve focus and in-progress form data during passive updates. Expose selected/expanded states. Covered media must not remain operable or exposed to assistive technology while its Reveal control remains accessible.
8. The lead integrates and checks the final files, then reports changes, tests and material limits. Do not claim live TikTok/Instagram verification from mocks or fixtures.

## Checks and delivery

Use Node.js 24+ and Python 3 for the optional demo server. This project intentionally has no package installation step.

Baseline commands from this directory:

```sh
node test-engine.mjs
node extension/test.mjs
```

Run new regression suites and syntax checks appropriate to touched files. Once `scripts/check.mjs` exists, prefer `node scripts/check.mjs` to run all maintained checks. Add meaningful regressions for concrete failures; do not substitute source-string assertions for runtime behaviour.

For browser fixtures, use an isolated test profile and local fixture data. Do not manipulate a user's signed-in social accounts for tests. Follow `docs/TESTING.md` when present. Record browser or live-account tests that remain unperformed.

Keep hosting metadata in `.openai/` and generated archives out of source submissions. Default delivery is local source plus a reviewable summary. Publishing, merging and sharing must follow the user's authorised scope; do not change repository visibility or send messages to collaborators on your own.
