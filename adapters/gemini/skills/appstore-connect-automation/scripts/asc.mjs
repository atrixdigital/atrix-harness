// Reusable App Store Connect API helper (ES256 JWT + REST).
// Config via env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_P8 (path to AuthKey_*.p8), ASC_APP_ID.
//   import { token, api, getAll, uploadAsset, ASC_APP_ID } from "./asc.mjs";
// or run a quick self-test:  node asc.mjs   (does GET /v1/apps)
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER = process.env.ASC_ISSUER_ID;
const P8 = process.env.ASC_P8; // e.g. ~/.appstoreconnect/AuthKey_XXXX.p8
export const ASC_APP_ID = process.env.ASC_APP_ID;
const BASE = "https://api.appstoreconnect.apple.com";

if (!KEY_ID || !ISSUER || !P8) {
  console.error("Set ASC_KEY_ID, ASC_ISSUER_ID, ASC_P8 (and usually ASC_APP_ID).");
}

/** Mint a short-lived ES256 JWT. Regenerate inside long loops (≤20 min lifetime). */
export function token() {
  const key = readFileSync(P8, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
  const body = b64({ iss: ISSUER, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" });
  // ieee-p1363 (raw r‖s) — NOT DER — is what JWT/ES256 requires.
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${sig.toString("base64url")}`;
}

export const ok = (s) => s >= 200 && s < 300;

/** Single request. Returns { status, json }. Pass a path (`/v1/...`) or full URL. */
export async function api(method, path, body) {
  const url = path.startsWith("http") ? path : BASE + path;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { json = { raw: txt }; }
  return { status: res.status, json };
}

/** Follow links.next and return the concatenated data[] across all pages. */
export async function getAll(path) {
  let out = [], url = path;
  while (url) {
    const r = await api("GET", url);
    if (!ok(r.status)) throw new Error(`GET ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    out.push(...(r.json.data || []));
    url = r.json.links?.next || null;
  }
  return out;
}

/**
 * 3-step asset upload (review screenshots, app screenshots, app previews, etc.).
 * reservePath: collection endpoint, e.g. "/v1/subscriptionAppStoreReviewScreenshots"
 * reserveType: resource type, e.g. "subscriptionAppStoreReviewScreenshots"
 * relationships: e.g. { subscription: { data: { type:"subscriptions", id } } }
 * Returns the asset id on success.
 */
export async function uploadAsset(reservePath, reserveType, relationships, filePath, fileName) {
  const bytes = readFileSync(filePath);
  const md5 = crypto.createHash("md5").update(bytes).digest("hex");
  // 1. reserve
  const res = await api("POST", reservePath, {
    data: { type: reserveType, attributes: { fileName: fileName || filePath.split("/").pop(), fileSize: bytes.length }, relationships },
  });
  if (!ok(res.status)) throw new Error(`reserve ${res.status}: ${JSON.stringify(res.json?.errors?.[0]?.detail || res.json).slice(0, 200)}`);
  const id = res.json.data.id;
  // 2. upload chunks
  for (const op of res.json.data.attributes.uploadOperations || []) {
    const headers = {};
    for (const h of op.requestHeaders || []) headers[h.name] = h.value;
    const slice = bytes.subarray(op.offset, op.offset + op.length);
    const ur = await fetch(op.url, { method: op.method, headers, body: slice });
    if (!ur.ok) throw new Error(`upload op ${ur.status}`);
  }
  // 3. commit
  const commit = await api("PATCH", `${reservePath}/${id}`, {
    data: { type: reserveType, id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  if (!ok(commit.status)) throw new Error(`commit ${commit.status}: ${JSON.stringify(commit.json?.errors?.[0]?.detail || commit.json).slice(0, 200)}`);
  return id;
}

/** Price every available territory from a base point's equalizations (UI auto-equalize equivalent). */
export async function priceAllTerritories(subId, basePricePointId) {
  const eq = await getAll(`/v1/subscriptionPricePoints/${basePricePointId}/equalizations?limit=200`);
  let set = 0, fail = 0;
  for (const p of eq) {
    const r = await api("POST", "/v1/subscriptionPrices", {
      data: { type: "subscriptionPrices", attributes: { startDate: null, preserveCurrentPrice: false },
        relationships: { subscription: { data: { type: "subscriptions", id: subId } },
          subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: p.id } } } },
    });
    ok(r.status) ? set++ : fail++; // transient 500s happen — re-run to retry failures (idempotent)
  }
  return { set, fail, total: eq.length };
}

// Self-test when run directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await api("GET", "/v1/apps?limit=5");
  console.log("GET /v1/apps ->", r.status);
  if (ok(r.status)) console.log(r.json.data.map((a) => `${a.attributes.name} (${a.id})`).join("\n"));
  else console.log(JSON.stringify(r.json).slice(0, 300));
}
