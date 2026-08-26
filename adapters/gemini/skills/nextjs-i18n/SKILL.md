---
name: nextjs-i18n
description: >
  Wire internationalisation into a Next.js App Router project with next-intl — locale
  routing, static rendering, translated metadata and hreflang, and message files that stay
  maintainable. Use when starting a new web project, adding a second language, translating
  a page or component, formatting dates, numbers or currency for a locale, or when text is
  hard-coded in JSX and needs extracting.
group: stack
---

# Next.js i18n

**Wire this on day one, even for a single-language product.** Retrofitting means touching every
component that renders a string, and it is the reason none of our existing apps have it. Standing
up `next-intl` with one locale costs an hour; adding the second then costs a translation file.

## The shape

```
src/
  i18n/
    routing.ts      defineRouting — the list of locales, the default
    request.ts      getRequestConfig — loads messages for the active locale
    navigation.ts   locale-aware <Link>, redirect, useRouter
  proxy.ts          negotiates locale, rewrites to /[locale]  ← NOT middleware.ts
  app/[locale]/     every route lives under here
messages/
  en.json  ar.json  …
```

**`proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention; next-intl's own docs still
say middleware, and under the old name the file compiles, lints, and never runs — no locale
negotiation, no error. The build output must print `ƒ Proxy (Middleware)`.

```ts
// src/proxy.ts
export const proxy = createMiddleware(routing);
export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
```

```ts
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
});
```

```ts
// src/i18n/request.ts
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
```

## `setRequestLocale` — the one that costs you SEO if you miss it

Every layout **and every page** calls it before rendering:

```tsx
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);        // ← without this the route is dynamic
  return <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>…</html>;
}
```

Omit it and the route opts out of static rendering. Nothing errors; the page just renders per
request, loses its cache, and the SEO you added i18n for gets slower rather than better. Pair it
with `generateStaticParams` — see `seo-and-analytics` for the related caching traps.

## Translating metadata

Metadata is content. It is what search engines and social cards actually read.

```tsx
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'HomePage' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
  };
}
```

The `languages` map emits `hreflang`. Without it, Google treats your locales as duplicate content
and picks one for everybody.

## Writing messages

Namespace by the component or page that uses them, so a deleted component takes its strings with
it. Flat, global message files rot into thousands of unused keys nobody dares remove.

**Never build a sentence by concatenation.** Word order differs between languages and the result is
untranslatable:

```tsx
// ✗ unfixable in any language that puts the verb elsewhere
<>{t('you have')} {count} {t('bookings')}</>

// ✓ one message, with the plural rules inside it
t('bookingCount', { count })
```

```json
{ "bookingCount": "{count, plural, =0 {No bookings} one {# booking} other {# bookings}}" }
```

ICU plural categories are per-language — Arabic has six, English two. Let the library resolve them;
never write `count === 1 ? …` in a component.

**Format dates, numbers and currency through `useFormatter`/`getFormatter`,** never with manual
`toLocaleString` calls scattered across components. Currency in particular: a price is an amount
*and* a currency, and formatting it in the wrong locale silently changes what the number means.

## RTL

Adding Arabic or Hebrew means `dir` flips. Use **logical properties** everywhere — `ps-4`/`pe-4`
rather than `pl-4`/`pr-4`, `text-start` rather than `text-left`, `border-s` rather than
`border-l`. Tailwind supports all of them, and using them from the start makes RTL a `dir`
attribute rather than a stylesheet rewrite.

Icons that imply direction (arrows, chevrons, back buttons) need flipping too; decorative and brand
marks do not.

### Isolate Latin data inside RTL text

Logical properties fix the *layout*. They do nothing for the **bidirectional algorithm**, which
reorders Latin runs sitting inside an RTL paragraph:

| Written | Renders in `ar` |
|---|---|
| `5 mg vial` | **`mg vial 5`** |
| `99.40 %` | **`% 99.40`** |
| `$62` | **`$US 62`** |

Wrap every Latin-script technical value — SKUs, codes, sequences, dimensions, versions, file
paths, measurements, formatted currency — in an isolate:

```tsx
<bdi dir="ltr">{peptide.format}</bdi>
```

`<bdi>` isolates by default; the explicit `dir="ltr"` covers the case where a value starts with a
digit, which the algorithm treats as neutral and inherits the surrounding direction from.

For currency, also pass `currencyDisplay: 'narrowSymbol'` — the default long form puts a Latin
currency code inside an Arabic run, which is the same problem again.

**This is invisible in the default locale and invisible in code review.** It only appears in a
rendered RTL page, which is the argument for standing the second locale up on day one rather than
at the end: an English-only build cannot show you this bug.

## Verify

- Visit `/en` and `/ar` and confirm both render statically — check the build output marks them
  prerendered, not dynamic.
- View source and confirm `<html lang>` and `dir` are correct, and `hreflang` links are present.
- Grep the diff for user-visible string literals in JSX. Every one is a missed extraction.
- Set the browser to an unsupported locale and confirm it falls back rather than 404s.
- **Screenshot the RTL locale and read the technical values.** Reversed units, percentages and
  currency are the bidi bug above, and nothing but a rendered page will show it.
