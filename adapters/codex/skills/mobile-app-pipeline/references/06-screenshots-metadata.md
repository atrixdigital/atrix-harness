# 06 — Screenshots & metadata

## Screenshots — the 2.3.7 rejection surface

**Rules that get you rejected if broken:**
- Screenshots must show the **actual app UI**. No mockups that misrepresent the app.
- **NO pricing, subscription terms, "free trial", discounts, or promotional claims** in a screenshot.
  This is a hard 2.3.7 rejection we ate — keep price talk on the paywall, never in a screenshot.
- **No other-platform references** (Android, "also on the web"), no placeholder/lorem, no device frames
  that imply the wrong device.
- Text overlays are fine (feature captions), as long as they're truthful and price-free.

**Sizes:** iPhone 6.7"/6.9" (required) — 1290×2796 (portrait). 6.5" often still needed. iPad only if
`supportsTablet:true`. Provide 3–6 per size that walk the core loop.

**Generating them (our approach):** compose on-brand PNGs from real screens with a PIL/Canvas script —
brand background, the actual screenshot, a short truthful caption in the app's fonts. Pull fonts from the
app's own font package (e.g. `node_modules/@expo-google-fonts/*`) and tokens from `theme/tokens.ts` so
they match the app exactly (bg, accent). Upload via the 3-step asset flow (`appStoreVersions` →
`appScreenshotSets` → `appScreenshots`; see `appstore-connect-automation`). Swap in real device captures
before final review if the generated ones are placeholders.

## App listing copy

- **Name** (≤30) — the brand. **Subtitle** (≤30) — the one-sentence promise, benefit-first.
- **Keywords** (100 chars total) — comma-separated, no spaces after commas (wasted chars), no repeating
  the app name/category (indexed already), singular forms, competitor terms only if truthful.
- **Description** — lead with the promise + top 3 benefits in the first 3 lines (that's what shows before
  "more"). Then a scannable feature list. Truthful; no pricing that contradicts the actual products.
- **Promotional text** (170 chars, updatable without review) — timely hook.
- **What's New** — real, specific release notes (not "bug fixes and improvements" every time).

## Privacy Policy & Terms pages

You need **live, functional** `/privacy` and `/terms` (EULA) URLs — linked in-app (paywall + profile) AND
in App Store Connect. Dead or missing links = 3.1.2(c). If there's no website, host simple pages on the
backend domain. Apple's standard EULA is acceptable if you link it; a custom Terms page is fine too.

## Consistency check

The screenshots, subtitle, and description must describe the **same app the reviewer runs**. Mismatch
(promising a feature not in the build, or vice-versa) invites rejection. Re-verify after any late feature
cut.
