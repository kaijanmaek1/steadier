# Steadier

A local-first prototype for mindful social-media use during recovery from depression. Includes a standalone demo and an experimental Edge/Chrome extension for TikTok and Instagram websites.

## Extension (v0.3.3)

TikTok sessions automatically skip videos flagged by your existing filters. Steadier checks already-loaded upcoming posts and advances toward an unflagged post, retrying when navigation stalls. Automatic mode adds no blocking screen or Reveal prompt. Scrolling forward skips loaded flagged posts when an acceptable loaded target is available. Turn off **Automatically skip softened TikTok videos** to use manual covers and Reveal. Refresh the extension and TikTok after updating. This is local navigation, not a change to TikTok's ranking or a guarantee that unflagged videos are positive.

1. Open edge://extensions or chrome://extensions and enable Developer mode.
2. Choose Load unpacked and select the extension directory.
3. Open or refresh TikTok or Instagram in the browser.
4. Move the Steadier mood slider, select memes/serious/mixed content, optionally enter a request and start a session.
5. Finish using End session & check mood.

Features: draggable panel; topic and style estimates from captions, hashtags, exposed subtitle text and loaded comments; native like/unlike detection when control state is exposed; session prompts; adjustable filtering; local export and deletion.

Example request: Calm nature videos and dogs, less politics.

The extension filters videos already delivered by the platforms. It cannot directly change their recommendation algorithms or run in their native mobile apps. Informational style is not a fact-check. Burned-in video text, audio transcription and general conversational AI are not implemented. Prompts use local English keyword rules. Site changes can affect detection; live logged-in testing remains necessary.

See [extension instructions and limitations](extension/README.md).

## Standalone sample-feed demo

On Windows, run start.cmd. Alternatively:

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. This demo uses sample posts and has a separate browser-local history from the extension.

## Checks

Use Node.js 24 or later:

```sh
node test-engine.mjs
node extension/test.mjs
node scripts/check.mjs
```

Tests cover classification, text-extraction fixtures, prompt interpretation, filtering, like-state interpretation, session storage, learning and platform isolation. They do not replace live browser testing.

The last command runs all maintained regression suites and JavaScript syntax checks. See [verification status and manual browser checks](docs/TESTING.md).

## Working with the specialist team

[AGENTS.md](AGENTS.md) defines the project lead's responsibilities, specialist ownership rules, three-worker limit and verification expectations. Reusable roles live in [.codex/agents](.codex/agents); project concurrency is configured in [.codex/config.toml](.codex/config.toml). Models and reasoning settings inherit from the primary task.

For future tasks, open this `steadier` directory as the Codex project so its project-level guidance and agent definitions can be discovered.

The current audit and prioritised remaining work are in [the improvement backlog](docs/IMPROVEMENT_BACKLOG.md). Use the primary conversation to give the lead a concrete goal; it coordinates specialists and integrates their changes.

## Privacy and learning

Mood, timing, topic labels, prompts, ratings and video identities stay in local browser storage. Raw caption and comment text is processed in memory. No Steadier server receives this data. Platform sites continue their own tracking. Export/delete controls are in the extension panel. Each platform has its own extension history, separate from the demo.

Explicit feedback has more influence than likes. Repeated session mood associations contribute conservatively. The extension adds weak, deduplicated like signals to the basic scoring heuristic. Mood changes do not prove that a video caused them.

This is a recovery-support prototype, not a clinically validated treatment or relapse-prevention system.
