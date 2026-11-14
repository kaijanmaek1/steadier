# Steadier

A local-first prototype for mindful social-media use during recovery from depression. Includes a standalone demo and an experimental Edge/Chrome extension for TikTok and Instagram websites.

## Extension (v0.3.0)

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
```

Tests cover classification, text-extraction fixtures, prompt interpretation, filtering, like-state interpretation, session storage, learning and platform isolation. They do not replace live browser testing.

## Privacy and learning

Mood, timing, topic labels, prompts, ratings and video identities stay in local browser storage. Raw caption and comment text is processed in memory. No Steadier server receives this data. Platform sites continue their own tracking. Export/delete controls are in the extension panel. Each platform has its own extension history, separate from the demo.

Explicit feedback has more influence than likes. Repeated session mood associations contribute conservatively. The extension adds weak, deduplicated like signals to the basic scoring heuristic. Mood changes do not prove that a video caused them.

This is a recovery-support prototype, not a clinically validated treatment or relapse-prevention system.
