---
name: seo-and-analytics
description: >
  Make a Next.js site findable and measurable — the Metadata API, JSON-LD, sitemaps,
  robots, canonical URLs, Google Analytics, and the App Router caching traps that quietly
  deindex pages. Use when launching a site, adding a public page, wiring analytics or
  Search Console, writing titles and descriptions, or investigating why pages are not
  indexed, not ranking, or not being crawled.
group: engineering
---

# SEO and analytics

## One module owns the metadata

Every project gets `src/lib/seo.ts` exporting the site constants and a `pageMetadata()` helper.
Per-page `export const metadata` objects assembled by hand drift within a month — one page ends up
with no Open Graph image, another with the wrong canonical, and nobody notices because nothing
fails.

```ts
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com').replace(/\/$/, '');

export function pageMetadata({ title, description, path, image }: PageMeta): Metadata {
  return {
    title, description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: { title, description, url: absoluteUrl(path), images: [image ?? DEFAULT_OG], type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}
```

Set `metadataBase` once in the root layout so relative image paths resolve. Without it, Open Graph
images silently ship as relative URLs and no crawler can fetch them.

**Titles and descriptions are for a human deciding whether to click.** Put the specific thing
first — the description is not a keyword bin, and stuffing it demonstrably lowers click-through.

## The caching traps that cost real traffic

These are ours, paid for in lost rankings:

- **A `[slug]` route needs `generateStaticParams` — even returning `[]` — to be cacheable at the
  CDN.** `revalidate` alone does nothing. Without it every page is dynamic, slow, and crawled as
  such.
- **Never add a root `app/loading.tsx`.** It made an entire site serve a skeleton to crawlers,
  which read it as a soft 404 sitewide.
- `next.config` headers cannot override Next's own `no-store`. Fix the route's caching, not the
  headers.
- Pick **one** canonical host — `www` or apex — and 301 the other. Serving both splits every
  ranking signal you have.

## Structured data

JSON-LD in the page, generated from the same source of truth as the visible content. If they can
disagree, they will, and mismatched structured data is treated as spam.

```tsx
<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema()) }} />
```

`Organization` and `WebSite` sitewide; `Article` on posts; `Product`/`Offer` where money is
involved; `BreadcrumbList` where there is a hierarchy. **Only mark up what is on the page.**
Fabricated `BlogPosting` schema on stub pages is a manual-action risk, and we have shipped it once.

## Sitemap, robots, llms.txt

`app/sitemap.ts` and `app/robots.ts` generate from real routes — a hand-maintained sitemap is
wrong the day after it is written. Exclude anything `noindex`.

Add `llms.txt` describing what the site is and which pages matter. AI crawlers are a real referral
source now; allow the reputable ones explicitly in `robots.ts` rather than leaving it to a default.

## Analytics

```tsx
import { GoogleAnalytics } from '@next/third-parties/google';
// in the root layout, after {children}
<GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
```

`@next/third-parties` loads GA off the main thread and after hydration, so it does not cost you the
Core Web Vitals the SEO work is buying. Never hand-roll the gtag snippet.

Gate it on the env var being present, so previews and local runs do not pollute production data.
Track a small number of events that map to outcomes — signup, booking, contact — not every click.
An analytics property with 40 event types answers no question at all.

**Verify Search Console at launch**, not when something goes wrong. Submit the sitemap, and check
Coverage and Manual Actions before assuming a ranking problem is algorithmic.

## Content is a ranking input, and thin content is a liability

Pages that exist to occupy a keyword get classified as scaled content abuse, and the penalty lands
on the **whole site**, not the offending URLs. We have taken this hit: a section deranked and
stopped being crawled entirely.

The gate is structural, not editorial — a page ships when it has something specific to say and a
source for its claims. If a page cannot be written without inventing figures, it does not ship.

## Verify

- `curl` the built page and read the actual HTML: title, description, canonical, OG tags, JSON-LD.
  Checking the source component proves nothing about what a crawler receives.
- Confirm the build marks public routes as prerendered, not dynamic.
- Validate structured data with Google's Rich Results Test before relying on it.
- Load the page and confirm exactly one GA request fires, with the right measurement ID.
