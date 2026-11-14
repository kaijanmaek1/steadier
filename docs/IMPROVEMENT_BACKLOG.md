# Steadier improvement backlog

Audit date: 2026-11-14. Source: working `steadier/` project, extension v0.3.0 and standalone demo. P1 means a correctness, privacy or access issue affecting a core workflow; P2 means an important usability or reliability improvement; P3 means a broader enhancement.

| Priority | Finding and desired result | Owner | Status |
| --- | --- | --- | --- |
| P1 | Website capture shortcuts swallow R/C while typing. Isolate prompt keyboard events in an embedded document while preserving drafts and focus. | Interactions | Implemented; eight maintained suites passed; native typing/browser checks pending |
| P2 | Nonmatching Instagram videos only receive covers. Enable safe automatic next-video navigation and retain a cover fallback where no safe target exists. | Programming / Lead | Implemented; control selection/navigation regressions passed; live Instagram verification pending |
| P2 | Remove the current-video topic correction selector while retaining feedback. | Interactions / Lead | Implemented; syntax and maintained suites passed; browser verification pending |
| P1 | Focused prompts let Unknown/unreadable unrelated videos through. Cover every nonmatch, recognise physics concepts without broad Learning matches, and recheck reveals after request changes. | Programming / Lead | Implemented; all maintained suites passed including saved-prompt/future-video regressions; live verification pending |
| P1 | Prompt spaces can reach platform keyboard shortcuts. Isolate panel keyboard events without cancelling typing defaults. | Interactions | Implemented; production event-isolation regression passed; live capture-handler behaviour unverified |
| P2 | Resize panel like an app from all edges and corners; keep an accessible keyboard corner grip and save size/position. | Interactions | Implemented; geometry regressions passed; browser verification pending |
| P2 | Dark website theme makes form controls hard to read. Use explicit light colour scheme, white text fields/dropdowns and black text. | Interactions / Lead | Implemented; syntax and maintained suites passed; browser verification pending |
| P2 | Flagged TikTok videos require manual scrolling. Add session-scoped automatic advancing, stalled-navigation retries, no-overlay automatic mode and forward-scroll lookahead, an off switch and bounded retry backoff. | Programming / Project lead | Implemented; six automated suites passed; live TikTok verification pending |
| P1 | GitHub contains top-level files but lacks the `dist/` and `extension/` source directories. Prepare the complete source and team setup in a reviewable branch. | Project lead | Complete source prepared for review; merge pending |
| P1 | Passive updates and preference actions reset mood confirmation, consent or keyboard focus. Preserve drafts and focus until the user completes/discards the check-in. | Interactions / UX | Implemented; automated checks passed |
| P1 | Feedback can target a video that has scrolled out of view. Disable current-video actions until a valid visible video is selected. | Interactions | Implemented; automated checks passed |
| P1 | Queued/delayed mutations can affect a newer session; busy actions can be silently dropped. Bind each mutation to its originating session and queue actions explicitly. | Programming / Interactions | Implemented; automated checks passed |
| P1 | Deletion leaves prompts/manual choices in memory; other tabs show stale session state. Reset in-memory data and reconcile external changes. | Programming / Interactions | Implemented; automated checks passed |
| P1 | Explicit exclusions miss mixed-topic captions, some negation is reversed, mixed-style requests become single-style. Preserve user intent and match excluded topics independently of the dominant category. | Programming | Implemented; automated checks passed |
| P1 | Strict uncertainty requires both unknown topic and unknown style. Apply uncertainty to each requested axis. | Programming | Implemented; automated checks passed |
| P1 | Visual covers leave media controls/captions available to keyboard/screen readers. Make underlying content inaccessible and restore attributes exactly while keeping Reveal usable. | Interactions / Accessibility QA | Implemented; automated checks passed |
| P2 | Missing feedback/collapse accessibility states and low-contrast demo text. Expose selected/expanded states and increase normal text contrast. | UI / Accessibility QA | Implemented; automated checks passed |
| P2 | Hidden-tab dwell, stale cover reasons and overly compressed interaction code impede reliability. Reset dwell on hide and make updates maintainable. | Interactions | Implemented; automated checks passed |
| P2 | Existing tests mainly cover rules and storage mocks. Add focused runtime regressions and a single repeatable check command. | QA / Project lead | Implemented; automated checks passed |
| P2 | TikTok/Instagram adapters and native like controls are not validated on signed-in live accounts. Exercise a documented manual matrix on both platforms before release. | Programming / QA | Pending live-account testing |
| P2 | DOM detection can miss subtitles, captions and comments or associate the wrong scope as platforms change. Add realistic captured/sanitised fixtures after live reproduction. | Programming / QA | Deferred; live evidence needed |
| P2 | History and likes grow without a retention policy, increasing repeated scoring work and eventual storage-quota risk. Define retention/export behaviour before limiting records. | Programming / UX | Deferred; policy decision needed |
| P3 | Burned-in text, speech and general prompt understanding need OCR/transcription or a model pipeline. Define consent, performance, accuracy and infrastructure first. | Project lead | Deferred; separate feature scope |
| P3 | Extension and demo retain separate data/engines. Decide whether unified history is useful before adding migration or synchronisation. | Project lead / UX | Deferred |

## Verification results

Before this batch, the two baseline suites passed but missed interaction/session/accessibility regressions. After integration, `node scripts/check.mjs` passed all five regression suites and syntax checks for 16 JavaScript files. All six specialist-role TOML files and the three-worker configuration parsed successfully. Read-only specialist review and lead integration review found and fixed additional mixed-version/session-reset races. See `docs/TESTING.md` for exact evidence limits. Implemented statuses do not imply browser or live-account verification.

The GitHub connection became available during this audit. Root directory inspection confirmed only `.gitignore`, `README.md`, `start.cmd` and `test-engine.mjs` on `main`. The complete source and team setup will be delivered through a draft pull request; it must not be described as merged until a merge is verified.


## 0.3.3 feature integration
All conversation improvements integrated with upstream automatic skipping; six regression suites and 18 syntax checks passed. PR merge and live-platform verification remain pending.
