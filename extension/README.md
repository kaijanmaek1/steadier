# Steadier for TikTok and Instagram websites

An experimental Chrome/Edge Manifest V3 extension. It overlays mood check-ins and softens selected videos on the actual websites. It does not change either platform's recommendation engine or run inside the native mobile apps.

## Version 0.3.1: reliability and accessibility fixes

This patch addresses session-scoped asynchronous actions, panel input/reset state, cross-tab state, current-video feedback, mixed-topic exclusions, negative/mixed-style requests, strict uncertainty and accessible cover restoration. The standalone demo also has more readable secondary text. The project now includes reusable lead/specialist roles and a repeatable check runner.

To update, open `edge://extensions` or `chrome://extensions`, click **Reload** on Steadier and refresh existing TikTok/Instagram tabs. Check that the version is **0.3.1**. Existing histories remain local; updated sessions use a unique identity to reject older-session feedback.

See [the verification record](../docs/TESTING.md) for automated evidence and manual tests still required. These fixes have not been validated on signed-in live feeds in this batch.

## Version 0.3: likes, content style and session prompts

Before starting a session, choose **Memes and humour**, **Serious / informational content**, or **A mix / follow my prompt**. The chosen style covers videos estimated to have the opposing style; unknown and mixed estimates remain visible unless you enable **Also soften uncertain videos**. “Serious” is not a truth or reliability label.

Write a request such as **Calm nature videos and dogs, less politics**. The interpretation preview shows recognised topics, literal words and exclusions. This is a local English rule parser, not Spotify or an LLM: it cannot understand every instruction or generate a new recommendation feed. Topic filtering applies to videos already served by the platform. You can change the request mid-session under **Change my session request**.

**Soften topics outside my request** covers known topics outside requested categories or literal keywords. Exclusions and manual Soften settings apply regardless of likes. Unknown words are matched as exact text tokens in available captions/hashtags/subtitles. Unknown videos remain visible by default. Expanded topic categories include animals, food, gaming, fitness, learning, travel, technology and sports.

Native like/unlike button clicks and video double-clicks are observed during active sessions. A like is recorded only after an exposed native control confirms a changed like state. Comment likes and popularity counts are ignored; existing likes at page load are not imported. Unsupported/localised controls may not expose a readable state and will not be counted. Look for **Like detected** or **Unlike detected** in the panel. The extension never clicks a Like button itself.

Likes are deduplicated by video identity, weighted at one quarter of an explicit rating, and remove their contribution when unliked. Explicit completed-session ratings override implicit likes for the same video. Likes change topic preference scores; they are not evidence of better mood and cannot override explicit topic or style choices. Your prompt, current intent and like labels are stored locally and included in export/delete.

Existing history is retained and added category preferences default to Adaptive. Follow the latest update instructions above.

## Version 0.2: movable panel and richer estimates

- Drag the Steadier heading to move the panel. Its position is remembered across both websites and kept inside the viewport after resizing. Keyboard users can focus the heading and use arrow keys (Shift for larger steps).
- Topic estimates combine hashtags, caption text, exposed subtitle overlays, active HTML text-track cues and up to five visible, loaded comments belonging to the current video. Caption/subtitle evidence has more topic weight than comments.
- The panel separately estimates **Meme / humour**, **Informational style**, **Mixed / uncertain** or **Unknown**, with a confidence label and the detected source list. Informational style does not mean true, and humour does not mean false. These labels currently explain the estimate; topic preferences still control filtering.
- Open the video's comments to let it read loaded comments. Their displayed order is used; the extension cannot guarantee that those are the platform's highest-ranked comments. It does not click, fetch hidden comments, or read unrelated comment threads.
- Topic corrections survive automatic reclassification. Evidence text is processed in memory; only the resulting labels and existing session metadata are saved.
- Text burned into a video image is **not supported** in this version. Reading those pixels requires an OCR pipeline; extracting speech requires transcription. DOM subtitle text and exposed text tracks are supported where available.
- These features remain available in the current release. Follow the latest update instructions above.

## Automatic TikTok skipping

During an active TikTok session, **Automatically skip softened TikTok videos** advances past videos flagged by your topic, style and request settings. Already-loaded upcoming posts are checked locally; Steadier jumps to the next loaded unflagged post when available, otherwise it tries the site's next-video control. It cannot inspect an unseen feed or reorder TikTok recommendations. Turn the option off to use covers and Reveal instead.

Automatic navigation retries stalled advances and waits briefly between bounded batches rather than switching itself off. Automatic mode creates no cover, blocking message or blank replacement. Forward wheel/ArrowDown navigation jumps over loaded flagged cards when an acceptable loaded target exists; flagged media is paused and muted while advancing. Turn skipping off to reveal manually. An unflagged video is not guaranteed to be positive or beneficial: the text rules can miss distressing content. OCR, speech and visual-action analysis remain unsupported. Instagram retains cover-and-reveal behaviour.

## Install locally

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `extension` folder, containing `manifest.json`.
4. Open or refresh https://www.tiktok.com or https://www.instagram.com and sign in normally.
5. Use the Steadier panel at the bottom right. Move the mood slider, consent to local storage and start a session.
6. Browse videos. After a video is at least 50% in view for two seconds, its estimated topic is recorded. Correct its topic and rate it in the panel.
7. Use **End session & check mood** before closing. If interrupted, the platform's session resumes on your next visit.

To test filtering immediately, set Nature or another matching category to **Soften** in Feed preferences during a session. Matching videos receive a cover and are paused. Select **Reveal video** to remove the cover, then resume playback yourself. Ratings and completed sessions update the extension's scoring rules. Unknown topics remain visible unless uncertainty softening is enabled.

## Important limits

- This uses weighted keyword and phrase rules across captions, hashtags, subtitle text and loaded comments, not audiovisual AI. Visual content, speech, sarcasm, multilingual content and posts without meaningful text may be missed or misclassified. Correct the topic manually in the panel. Do not rely on this extension to block all distressing content.
- TikTok and Instagram change their page structure. Video container detection is a best-effort adapter. Reel pages without article containers may expose less reliable captions/identities. Some covers may appear only after content first loads. Inspect behaviour on your account before relying on it.
- Does not automatically like, dislike, follow or send “Not interested” feedback. Website ranking remains controlled by the platform. Covering a video locally may still contribute platform impressions.
- Excludes Instagram direct messages/account screens and TikTok messages/inbox/login/settings. It does not request passwords, cookies, microphone access, browsing history or access to other websites.
- Processes nearby rendered text locally but stores only video identity (post path, or a non-cryptographic text hash as a fallback), category, mood, timing and explicit ratings. Raw captions are not saved. Hashes are identifiers, not encryption; repeated captions may be treated as the same video. Nothing is sent to a Steadier server. Platform sites continue their own normal tracking.
- History is separate from the demo app, and separated by platform. Multiple tabs on one platform share an active session. Use the extension panel to export or delete that platform's data. Removing the extension removes extension storage.
- Mood scores are not a diagnosis. The scoring heuristic is not clinically validated.

## Verification

`node extension/test.mjs` from the project root checks classification and service-worker messaging/storage with a mock extension environment. `node test-engine.mjs` checks scoring. Logged-in browser testing on both live services is still required; it was not available during implementation.
