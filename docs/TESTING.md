# Verification and manual release checks

## Automated checks

From the repository root with Node.js 24+:

```sh
node scripts/check.mjs
```

The runner validates extension resource paths, syntax-checks JavaScript modules and runs the demo engine plus all `extension/test*.mjs` suites. It has no dependency-installation step.

| Suite | What its evidence establishes |
| --- | --- |
| `test-engine.mjs` | Demo mood validation, session completion, scoring and preference overrides |
| `extension/test.mjs` | Existing extension rules, extracted-text fixtures, likes, prompt policy and mocked service-worker/storage behaviour |
| `extension/test-functionality.mjs` | Mixed-topic exclusions, negation/mixed-style requests, strict uncertainty, originating-session validation and rejected invalid/private-route messages |
| `extension/test-interactions.mjs` | Panel state preservation/reset, queued-action outcomes and eligible current-video selection using production helpers |
| `extension/test-accessibility.mjs` | Production media-mask attribute ownership/restoration on DOM-shaped fixtures and secondary-text contrast calculated from source colours |

Fixture objects and mock storage do not establish live selector accuracy, native browser focus, tab order, the accessibility tree or screen-reader output. Source-colour contrast calculations do not establish the browser's computed cascade in every state.

Agent-definition TOML is also parsed locally with Python's standard `tomllib`, checking the required role fields and the three-specialist concurrency configuration. This needs Python 3.11+ and is separate from the Node runner.

## Recorded automated outcome

The final integrated `node scripts/check.mjs` run passed **five regression suites**, syntax checks for **16 JavaScript files**, and all manifest resource checks. All six reusable-role TOML files and the three-specialist configuration parsed successfully. These are automated/source-fixture results, not live browser verification.

Session and deletion fences are enforced by updated page scripts; reload all existing social-site tabs after updating. Legacy message compatibility is retained for interrupted older sessions, so an unrefreshed old page must not be assumed to have the new client-side safeguards.

## Browser testing status

An isolated local Edge headless probe failed before rendering because the GPU process could not start (`GPU process isn't usable`). No successful browser rendering, live TikTok/Instagram visit, real like/unlike observation, screen-reader test or keyboard walkthrough is claimed by this batch. No signed-in user browser profile was used for the failed probe.

## Manual release matrix

Run the following on **both TikTok web and Instagram web**, using the intended supported Edge/Chrome version. Record browser version, URL type, date, expected result and observed result. Do not record passwords or unrelated account content in fixtures or screenshots.

1. **Install/update:** reload Steadier at `edge://extensions` or `chrome://extensions`, refresh the website and verify one panel appears.
2. **Check-in retention:** move the mood slider, tick consent, type a request and change a preference. Collapse/expand, navigate within the website and reopen details. Scores, confirmation, consent and unfinished request should remain intact unless the session changes or data is deleted.
3. **Keyboard/focus:** tab through all controls and operate sliders, selects, feedback and details. Passive video updates must not remove the focused control. Starting/ending a session should move focus to the next relevant control, and status messages should be concise.
4. **Drag:** drag the heading; move it using focused-heading arrow keys and Shift+arrows. Resize the window, expand and collapse the panel. The heading and controls should remain reachable. Check narrow viewports and 200% zoom.
5. **Visible video:** scroll away from the current video, pause on an uncovered video for two visible seconds and switch browser tabs. Feedback must never silently target an old video, and hidden-tab time must not count as watched time.
6. **Exclusions:** request `nature, no politics`; a caption containing both forest and politics should still be softened. Request `no politics and comparison`, then a mix of memes and serious content, and check the interpretation preview.
7. **Uncertainty:** enable serious style and uncertainty softening. A known Nature topic with unknown style must be softened. With uncertainty softening disabled, the estimate should remain explicit and revealable.
8. **Available evidence:** inspect caption/hashtag estimates, exposed subtitles and comments belonging to the selected video. Open/close comment drawers, move to the next video and ensure comments from another video do not leak into its estimate. Document selectors that fail.
9. **Cover accessibility:** soften a known topic. Native covered controls/captions must be excluded from keyboard/screen-reader interaction; Reveal remains reachable. Reveal restores pre-existing accessibility attributes and does not unexpectedly start playback. Check content inserted while covered and platform attempts to autoplay it.
10. **Native likes:** during an active session, like a video with a readable native state and look for confirmation. Repeated observation must not duplicate it; unlike removes its weak preference signal. Existing likes on page load and comment likes must not count as new video likes. Test double-click where supported.
11. **Cross-tab session:** open two tabs of one platform. Start/end a session in one tab and verify the other updates. A delayed old-session action must be rejected after ending/resetting and starting a new session, including mixed old/new extension tabs during an update.
12. **Delete:** delete while active and while inactive. Check that mood, saved prompts, feedback, likes and manual topic choices do not reappear in any tab, and that covered media is restored. Old queued work must not recreate records. The other platform's separate history should remain intact.
13. **Interrupted session/export:** close/reopen the website, finish the same session and export local data. Check that raw captions/comments were not saved and the documented metadata is present.
14. **Private routes:** visit direct messages, account/settings and login routes. Recording/filtering should be paused; existing session data must not grow from activity on those screens.

The demo additionally needs a browser pass for its first-session flow, insights, preferences, mobile layout, export and deletion. Its history is intentionally separate from the extension.
