# 02 — App architecture (the proven Expo scaffold)

This is the battle-tested structure for a new app. It's TypeScript-strict, Expo Router (file-based),
Zustand + AsyncStorage for state, a theme-token design system, a billing adapter, a fail-safe API client,
and analytics. Copy the shape; adapt the domain.

**Delegate the construction to the official Expo skills** — this file is the *architecture + the
patterns that bit us*; those skills are the deep how-to:
- **`expo:building-native-ui`** (+ `expo:expo-ui`) — screens, navigation, native tabs, animations.
- **`expo:native-data-fetching`** — fetch / React Query / SWR / streaming / offline / Router loaders.
- **`expo:expo-tailwind-setup`** — if you want Tailwind/NativeWind instead of raw token styles.
- **`expo:expo-module`** — only if you need a custom native module.
- **`expo:upgrading-expo`** — pin the latest stable SDK at scaffold time and for later upgrades.

## Contents

- Stack (defaults)
- Folder shape
- Load-bearing patterns (do these from the start)
- app.json essentials (get these right up front — they prevent review stalls)
- Quality gates while building

## Stack (defaults)

- **Expo SDK (latest stable)** + **expo-router** (file-based nav) + **React Native** + **React**, TS strict.
- **Zustand + `persist`/AsyncStorage** for app state (onboarding, deviceId, entitlement cache, usage meters).
- **react-native-reanimated** for motion; **expo-haptics** for feel.
- **RevenueCat** (`react-native-purchases`) behind a billing **adapter** (so a mock works in dev/sim).
- **expo-notifications** (push), **expo-image-picker**, **expo-sharing**, **react-native-view-shot** as needed.
- A **design-token theme** (dark-first): `color`, `font`, `radius`, spacing — one source of truth.

## Folder shape

```
app/                      # expo-router screens (file = route)
  _layout.tsx             # root stack; font load, hydration gate, onboarding gate, boot effects
  onboarding.tsx          # capture 3-4 context facts → seed personalization + reach the aha fast
  (tabs)/                 # tab group: index (home), + domain tabs, profile
  chat.tsx | <core>.tsx   # the core-loop screen
  premium.tsx             # paywall (see references/04)
  usage.tsx               # usage/limits dashboard (if metered)
  billing.tsx             # manage subscription
src/
  api/                    # config.ts (base URL), one file per endpoint, all fail-safe
  billing/                # adapter (real RevenueCat + mock), plans.ts = single source of limits
  store/                  # app-store.ts (zustand persist), partialize the durable slice
  components/             # Icon, Button, Screen, ui primitives, motion
  theme/                  # tokens.ts (color/font/radius), fonts.ts
  lib/                    # analytics, haptics, premium helpers, notifications
  types/                  # domain types
```

## Load-bearing patterns (do these from the start)

**Anonymous device identity.** Generate a persistent `deviceId` (`dev-<base36ts>-<rand>`) on first run,
persisted. Everything server-side keys off it — no login required (great for conversion + review). If the
app IS login-gated, provide demo reviewer creds (references/09).

**Hydration gate in `_layout`.** Don't render UI until fonts loaded AND the persisted store rehydrated;
gate onboarding on `onboarded`. Reconcile entitlement + any server sync in a boot effect. Re-lock gating
the instant a trial/sub lapses (schedule a check at `expiresAt`).

**Billing adapter, not direct SDK calls.** `getBilling()` returns real RevenueCat on device, a mock in
Expo Go/sim. Screens call `configure()`, `getOfferings()`, `purchase()`, `getEntitlement()` — never the
SDK directly. This keeps dev unblocked and makes the paywall testable.

**Single source of limits (`plans.ts`).** All per-tier quotas live in one `PLAN_LIMITS[tier][resource]`
map + `RESOURCE_META`. Adding a metered resource is ~4 lines. The store's `canUse`/`noteUsage`/
`usageState` read from it; the server enforces the same numbers (references/03).

**Fail-safe API client.** Every network call returns a graceful fallback offline / on error — never
throws into the UI. Native fetch isn't subject to CORS, so the app can call the same backend the website
uses. For streaming (NDJSON), read `XMLHttpRequest.responseText` incrementally (RN fetch can't stream).

**Analytics from day one.** A batched, device-keyed, fire-and-forget `track()` (see references/10). You
cannot improve retention you can't see; wire it before launch, not after.

**Design tokens, dark-first.** One `tokens.ts` (`color.bg`, `color.accent`, `font.display`, `radius`).
Every component reads tokens; no hardcoded hex. Set `userInterfaceStyle` + `backgroundColor` in app.json
to match so there's no white flash.

## app.json essentials (get these right up front — they prevent review stalls)

```jsonc
{
  "expo": {
    "name": "...", "slug": "...", "owner": "...",
    "version": "1.0.0",                 // MARKETING version — bump every release (see references/07)
    "scheme": "...", "userInterfaceStyle": "dark", "backgroundColor": "#0D0B08",
    "runtimeVersion": { "policy": "appVersion" },
    "ios": {
      "bundleIdentifier": "com.owner.app",
      "supportsTablet": false,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,          // skip the encryption questionnaire (HTTPS-only)
        "NS...UsageDescription": "..."                    // one honest string per sensitive API you use
      },
      "privacyManifests": {                               // required; declare the reasons you actually use
        "NSPrivacyTracking": false,
        "NSPrivacyCollectedDataTypes": [],
        "NSPrivacyAccessedAPITypes": [
          { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults", "NSPrivacyAccessedAPITypeReasons": ["CA92.1"] },
          { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp", "NSPrivacyAccessedAPITypeReasons": ["C617.1"] },
          { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime", "NSPrivacyAccessedAPITypeReasons": ["35F9.1"] },
          { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace", "NSPrivacyAccessedAPITypeReasons": ["E174.1"] }
        ]
      }
    },
    "plugins": ["expo-router", "expo-font", /* expo-audio, expo-notifications, expo-splash-screen, expo-sharing as used */],
    "extra": {
      "apiBaseUrl": "https://...",
      "revenuecatIosKey": "appl_...",
      "eas": { "projectId": "..." }
    }
  }
}
```

## Quality gates while building

Run after each batch of changes (from the app dir):
- `npm run typecheck` (`tsc --noEmit`) — must be clean.
- `npm run lint` (`expo lint`) — 0 errors. Watch for `react-hooks/set-state-in-effect` (don't call
  setState synchronously in an effect — derive state or set inside an async callback).
- `npx expo export --platform ios` — the bundle must build before you ever kick an EAS build.
- After any UI screen: run the **ux-reviewer** agent.

Then → references/03 (backend, if any) or references/04 (monetize).
