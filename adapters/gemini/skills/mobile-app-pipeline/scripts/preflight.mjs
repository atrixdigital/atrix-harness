#!/usr/bin/env node
/* Pre-submission preflight for an Expo iOS app.

   Runs the mechanical checks from references/09 so self-inflicted rejections
   (references/08) are caught before Apple catches them. Static + URL checks by
   default; add --build to also run typecheck/lint/export.

   Usage:
     node preflight.mjs [appDir] [--live-version=X.Y.Z] [--build]
       appDir           path to the Expo app (default: cwd)
       --live-version   the version currently LIVE on the App Store, to catch the
                        "already submitted this version" trap (bump expo.version)
       --build          also run: npm run typecheck, npm run lint, expo export

   Exit code is non-zero if any check FAILs (WARNs don't fail the run). */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const appDir = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const liveVersion = (args.find((a) => a.startsWith("--live-version=")) ?? "").split("=")[1] || null;
const doBuild = args.includes("--build");

const results = [];
const add = (status, name, detail = "") => results.push({ status, name, detail });
const C = { pass: "\x1b[32m✓\x1b[0m", warn: "\x1b[33m!\x1b[0m", fail: "\x1b[31m✗\x1b[0m" };

/* ---- load app config ---- */
function loadAppJson() {
  for (const f of ["app.json", "app.config.json"]) {
    const p = join(appDir, f);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")).expo ?? JSON.parse(readFileSync(p, "utf8"));
  }
  return null;
}
const cfg = loadAppJson();
if (!cfg) {
  console.error(`No app.json found in ${appDir}. (app.config.js is not read by this static checker.)`);
  process.exit(2);
}

const ios = cfg.ios ?? {};
const infoPlist = ios.infoPlist ?? {};
const extra = cfg.extra ?? {};
const plugins = (cfg.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));

/* ---- version discipline ---- */
const version = cfg.version ?? "0.0.0";
const cmp = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
};
if (liveVersion) {
  if (cmp(version, liveVersion) > 0) add("pass", "Marketing version bumped", `${liveVersion} → ${version}`);
  else add("fail", "Marketing version NOT bumped", `expo.version=${version} is not > live ${liveVersion} — auto-submit will fail ("already submitted this version"). Bump expo.version.`);
} else {
  add("warn", "Marketing version", `expo.version=${version} — pass --live-version=X.Y.Z to verify it's ahead of the App Store.`);
}

/* ---- export compliance ---- */
if (infoPlist.ITSAppUsesNonExemptEncryption === false) add("pass", "Export compliance set", "ITSAppUsesNonExemptEncryption:false");
else if (infoPlist.ITSAppUsesNonExemptEncryption === true) add("warn", "Export compliance = true", "Every build will need the encryption questionnaire. Set false if HTTPS-only.");
else add("fail", "Export compliance missing", "Add infoPlist.ITSAppUsesNonExemptEncryption (false when HTTPS-only) to avoid per-build stalls.");

/* ---- privacy manifest ---- */
const pm = ios.privacyManifests;
if (pm && Array.isArray(pm.NSPrivacyAccessedAPITypes) && pm.NSPrivacyAccessedAPITypes.length)
  add("pass", "Privacy manifest present", `${pm.NSPrivacyAccessedAPITypes.length} API reason(s)`);
else add("fail", "Privacy manifest missing", "Add ios.privacyManifests.NSPrivacyAccessedAPITypes (UserDefaults/FileTimestamp/BootTime/DiskSpace reasons).");

/* ---- bundle identifier ---- */
if (ios.bundleIdentifier && /^[a-zA-Z0-9.-]+$/.test(ios.bundleIdentifier)) add("pass", "iOS bundle identifier", ios.bundleIdentifier);
else add("fail", "iOS bundle identifier missing/invalid", "Set ios.bundleIdentifier (com.owner.app) — required to build/submit.");

/* ---- icon + splash assets exist ---- */
function assetExists(rel) { return rel && existsSync(join(appDir, rel)); }
if (assetExists(cfg.icon)) add("pass", "App icon present", cfg.icon);
else add("fail", "App icon missing", `expo.icon=${cfg.icon ?? "(unset)"} — file not found; required for submission.`);
const splashPlugin = (cfg.plugins ?? []).find((p) => Array.isArray(p) && p[0] === "expo-splash-screen");
const splashImg = splashPlugin?.[1]?.image ?? cfg.splash?.image;
if (assetExists(splashImg)) add("pass", "Splash image present", splashImg);
else add("warn", "Splash image", `${splashImg ?? "(unset)"} — not found; set a splash so there's no blank launch.`);

/* ---- eas.json build profile ---- */
const easPath = join(appDir, "eas.json");
if (existsSync(easPath)) {
  try {
    const eas = JSON.parse(readFileSync(easPath, "utf8"));
    const profiles = Object.keys(eas.build ?? {});
    if (profiles.length) add("pass", "eas.json build profiles", profiles.join(", ") + (profiles.includes("production") ? "" : " (no 'production' profile?)"));
    else add("fail", "eas.json has no build profiles", "Add a build profile (e.g. production) to eas.json.");
  } catch { add("fail", "eas.json invalid JSON", easPath); }
} else add("fail", "eas.json missing", "Run `eas build:configure` — required for EAS build/submit.");

/* ---- permission usage strings ---- */
const NEEDS = {
  "expo-camera": "NSCameraUsageDescription",
  "expo-image-picker": "NSPhotoLibraryUsageDescription",
  "expo-media-library": "NSPhotoLibraryUsageDescription",
  "expo-location": "NSLocationWhenInUseUsageDescription",
  "expo-audio": "NSMicrophoneUsageDescription",
  "expo-av": "NSMicrophoneUsageDescription",
  "expo-contacts": "NSContactsUsageDescription",
};
const pluginConfigStr = JSON.stringify(cfg.plugins ?? []);
for (const [plugin, key] of Object.entries(NEEDS)) {
  if (!plugins.includes(plugin)) continue;
  // Satisfied by an infoPlist string OR an inline permission in the plugin config.
  const inlineHint = /[Pp]ermission/.test(pluginConfigStr);
  if (infoPlist[key]) add("pass", `Usage string for ${plugin}`, key);
  else if (inlineHint) add("warn", `Usage string for ${plugin}`, `Not in infoPlist.${key}; verify the plugin config provides it.`);
  else add("fail", `Usage string for ${plugin} missing`, `Add infoPlist.${key} (Apple rejects sensitive APIs without a purpose string).`);
}

/* ---- api base url points at prod ---- */
const base = extra.apiBaseUrl || "";
if (!base) add("warn", "apiBaseUrl", "No extra.apiBaseUrl — confirm the app knows its backend (or is fully local).");
else if (/localhost|127\.0\.0\.1|:\d{4,5}\b|preview|ngrok/.test(base)) add("fail", "apiBaseUrl not production", base);
else add("pass", "apiBaseUrl is production", base);

/* ---- revenuecat key (only if the app monetizes) ---- */
if (extra.revenuecatIosKey) add("pass", "RevenueCat iOS key present", "");
else add("warn", "RevenueCat iOS key", "No extra.revenuecatIosKey — fine if the app has no subscriptions.");

/* ---- terms + privacy URLs resolve ---- */
function findLegalUrls() {
  const urls = new Set();
  if (extra.termsUrl) urls.add(extra.termsUrl);
  if (extra.privacyUrl) urls.add(extra.privacyUrl);
  // Grep a config file for TERMS_URL / PRIVACY_URL constants.
  const candidates = ["src/api/config.ts", "src/lib/config.ts", "src/config.ts", "app/config.ts"];
  for (const rel of candidates) {
    const p = join(appDir, rel);
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, "utf8");
    for (const m of txt.matchAll(/(?:TERMS_URL|PRIVACY_URL)\s*=\s*["'`]([^"'`]+)["'`]/g)) urls.add(m[1]);
  }
  if (base) { urls.add(base.replace(/\/$/, "") + "/terms"); urls.add(base.replace(/\/$/, "") + "/privacy"); }
  return [...urls];
}
async function checkUrls() {
  const urls = findLegalUrls();
  if (!urls.length) { add("fail", "Terms/Privacy URLs", "None found — 3.1.2(c) requires functional Terms + Privacy links."); return; }
  let anyTerms = false, anyPrivacy = false;
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: "GET" });
      const ok = r.status >= 200 && r.status < 400;
      if (/term|eula/i.test(u) && ok) anyTerms = true;
      if (/privacy/i.test(u) && ok) anyPrivacy = true;
      add(ok ? "pass" : "fail", `URL ${r.status}`, u);
    } catch (e) {
      add("fail", "URL unreachable", `${u} — ${e.message}`);
    }
  }
  if (!anyTerms) add("fail", "Terms/EULA link", "No reachable Terms/EULA URL (3.1.2(c)).");
  if (!anyPrivacy) add("fail", "Privacy Policy link", "No reachable Privacy URL (3.1.2(c)).");
}

/* ---- optional heavy build checks ---- */
function runBuildChecks() {
  const steps = [
    ["expo-doctor", "npx --yes expo-doctor"],
    ["typecheck", "npm run typecheck"],
    ["lint", "npm run lint"],
    ["ios export", "npx expo export --platform ios"],
  ];
  for (const [name, cmd] of steps) {
    try {
      execSync(cmd, { cwd: appDir, stdio: "pipe" });
      add("pass", `Build: ${name}`, cmd);
    } catch (e) {
      add("fail", `Build: ${name} failed`, `${cmd} — see output: ${String(e.stdout || e.message).slice(-300)}`);
    }
  }
}

/* ---- run ---- */
await checkUrls();
if (doBuild) runBuildChecks();

console.log(`\nPreflight — ${cfg.name ?? "app"} v${version}  (${appDir})\n`);
for (const r of results) console.log(`  ${C[r.status]} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
const fails = results.filter((r) => r.status === "fail").length;
const warns = results.filter((r) => r.status === "warn").length;
console.log(`\n${fails} fail · ${warns} warn · ${results.length - fails - warns} pass`);
console.log(
  fails
    ? "\n\x1b[31mNOT ready to submit — fix the failures above, then re-run.\x1b[0m\n" +
        "Reminder: submitting is a user-owned decision — confirm the exact version with the user first.\n"
    : "\n\x1b[32mMechanical checks pass.\x1b[0m Now walk the manual gates in references/09, then get an explicit\n" +
        "user 'yes' on the exact version before submitting. If resubmitting, cancel the prior submission first.\n"
);
process.exit(fails ? 1 : 0);
