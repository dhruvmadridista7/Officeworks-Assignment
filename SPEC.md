# SPEC.md — Product Catalogue PoC (source of truth)

Status: **v1, agreed before coding.** If you must deviate, record it in
DECISIONS.md and update this file.

## 1. Purpose and scope

A product catalogue where customers browse featured products, browse by category,
search, view a product, and submit an enquiry that emails the sales inbox.
It is a proof of concept the entrepreneur can interact with, built as a
**foundation that grows** (not a throwaway). Three things are expected to change:
the **product data source**, the **look and feel**, and the **email provider**.

## 2. Architecture

```
Browser ──► apps/web (React) ──► apps/api (Express) ──► ProductRepository (port)
                                       │                    └─ FakeStoreProductRepository (adapter)
                                       └──────────────────► EmailSender (port)
                                                             ├─ SmtpEmailSender (nodemailer)
                                                             └─ ConsoleEmailSender
```

API layers: `http (routes/controllers/middleware)` -> `services` -> `domain ports`
<- `adapters`. Dependencies point inward; the domain knows nothing about Express,
Fake Store or nodemailer.

Swap points:
- Data source: new class implementing `ProductRepository`; change wiring in `server.ts`.
- Email provider (e.g. AWS SES): new class implementing `EmailSender`; change wiring.
- Look and feel: edit `styles/tokens.css` and shared components only.

Repo layout:

```
apps/api/src/{config,domain,adapters,services,http}/ , app.ts, server.ts
apps/web/src/{api,features,components,styles}/
```

## 3. Assumptions (where the acceptance criteria are unclear)

| # | Assumption |
|---|---|
| A1 | **Featured:** the entrepreneur *chooses* the 5 products. Source = optional `FEATURED_PRODUCT_IDS` env (exactly 5 unique positive integer IDs, order preserved). If missing, malformed, not exactly 5 unique IDs, or any ID is not in the catalogue, fall back to the 5 highest rated and log a warning. Fallback ranking is `rating.rate` descending, then `rating.count` descending, then `id` ascending for deterministic ties. This is an intentional exception to fail-fast environment validation; other invalid configuration still fails startup. Implemented behind a `FeaturedPolicy` so an admin UI/DB can replace it. |
| A2 | **Category "top rated":** top 3 products in the category by `rating.rate` desc, ties by `rating.count` desc, then `id` asc. "Additional products" = all remaining products in that category (ordered by `id`), no overlap with top rated. |
| A3 | **Search:** server-side, trimmed phrase, case-insensitive **substring** match on product title, description and category name. Triggered by search button or Enter only (not as-you-type). Empty/whitespace query -> 400. Max 100 chars. Results in upstream order. |
| A4 | **Enquiry fields:** productId (required), name (required), email (required), phone (optional), message (optional, max 1000). Nothing is persisted (documented gap). If email delivery fails the customer sees an error, never a false "Thank you". |
| A5 | **Enquiry abuse protection:** per-IP rate limit on the enquiry route, a hidden honeypot field, body size limit. |
| A6 | **Resilience:** upstream calls have a timeout, bounded retries with backoff, and an in-memory TTL cache. Retry network failures, timeouts, and upstream 5xx responses; do not retry 4xx responses or invalid upstream data. Upstream failure -> 502 with a clean message. |
| A7 | **Category slugs:** URL-safe slugs derived from upstream names (lowercase, apostrophes removed, spaces -> hyphens): `electronics`, `jewelery` (upstream spelling), `mens-clothing`, `womens-clothing`. Slug -> upstream name mapping is built from the upstream category list at runtime, not hardcoded. |
| A8 | **Single email, single inbox:** one sales inbox (`SALES_INBOX`), plain customer data in the body, `replyTo` = customer's email. No customer confirmation email. |
| A9 | **Product IDs:** positive integers. Invalid -> 400, unknown -> 404. Note Fake Store may return an empty body with HTTP 200 for unknown IDs; the adapter must treat that as "not found". |
| A10 | **No pagination:** dataset is ~20 products. Documented as a cut. |

## 4. Data model

Domain/API `Product`:

```ts
type Product = {
  id: number;
  title: string;
  price: number;           // as provided by source, currency not modelled in PoC
  description: string;
  image: string;           // URL
  category: { slug: string; name: string };
  rating: { rate: number; count: number };
};
type Category = { slug: string; name: string };
```

Fake Store upstream (for reference): `https://fakestoreapi.com` ->
`GET /products`, `GET /products/:id`, `GET /products/categories`. Upstream product:
`{ id, title, price, description, category, image, rating: { rate, count } }`.
Validate upstream responses with zod at the adapter boundary; map to the domain
type there. Nothing outside the adapter knows the upstream shape.

## 5. API contract

Base path `/api`. JSON only.

| Method | Path | Success | Notes |
|---|---|---|---|
| GET | `/api/health` | 200 `{ status: "ok" }` | no upstream call |
| GET | `/api/products/featured` | 200 `{ products: Product[] }` | per A1, exactly 5 |
| GET | `/api/categories` | 200 `{ categories: Category[] }` | |
| GET | `/api/categories/:slug` | 200 `{ category, topRated: Product[], others: Product[] }` | per A2; unknown slug -> 404 `CATEGORY_NOT_FOUND` |
| GET | `/api/products?q=term` | 200 `{ query: string, products: Product[] }` | per A3; empty `q` -> 400 `VALIDATION_ERROR` |
| GET | `/api/products/:id` | 200 `{ product: Product }` | 400 bad id, 404 `PRODUCT_NOT_FOUND` |
| POST | `/api/enquiries` | 201 `{ status: "received" }` | see section 6 |

Route order: `/api/products/featured` must be registered before `/api/products/:id`.

**Error shape (all errors):**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "details": [ { "field": "email", "message": "Invalid email" } ] } }
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | bad params/query/body |
| `PRODUCT_NOT_FOUND` | 404 | unknown product |
| `CATEGORY_NOT_FOUND` | 404 | unknown category slug |
| `ROUTE_NOT_FOUND` | 404 | unknown route |
| `RATE_LIMITED` | 429 | enquiry rate limit hit |
| `UPSTREAM_ERROR` | 502 | product source failed/timeout/invalid data |
| `EMAIL_DELIVERY_FAILED` | 502 | email provider failed |
| `INTERNAL_ERROR` | 500 | anything unexpected (no internals leaked) |

## 6. Enquiry

Request body:

```json
{ "productId": 3, "name": "Jane Doe", "email": "jane@example.com",
  "phone": "+91 98765 43210", "message": "Is this in stock?", "website": "" }
```

Validation: `productId` positive int; `name` trimmed 1–100; `email` valid, <=254;
`phone` optional, 7–20 chars of digits, spaces, `+ - ( )`; `message` optional,
<=1000; `website` is the **honeypot** (must be empty/absent).

Behaviour:
1. Honeypot filled -> respond **201 exactly like success**, send nothing, log it.
2. Product must exist (via `ProductRepository`) else 404 `PRODUCT_NOT_FOUND`.
3. Build email: to `SALES_INBOX`, from `EMAIL_FROM`, `replyTo` customer email,
   subject `New enquiry: <product title> (#<id>)` (CR/LF stripped), text + HTML
   bodies including product id/title/price, name, email, phone, message.
   **HTML-escape all user content.**
4. Send via `EmailSender`. Success -> 201. Failure -> 502 `EMAIL_DELIVERY_FAILED`.
5. Rate limit: `ENQUIRY_RATE_LIMIT_MAX` per `ENQUIRY_RATE_LIMIT_WINDOW_MS` per IP
   -> 429 `RATE_LIMITED`. This route only.

`SmtpEmailSender` uses nodemailer with env config. `ConsoleEmailSender` is used
when `SMTP_HOST` is empty and just logs the email. A future SES adapter
implements the same `EmailSender` interface.

## 7. Web app

Routes:

| Path | Content |
|---|---|
| `/` | Home: the 5 featured products (product tiles) |
| `/category/:slug` | "Top rated" section + "More in this category" section |
| `/search?q=` | Results for the query; header search bar with a Search button |
| `/products/:id` | Product details + **Enquire** button |
| `/products/:id/enquire` | Enquiry form -> on success shows a **Thank you** message |

Shared layout: header (logo/title, search bar, category links loaded from
`/api/categories`), main, footer.

Rules:
- Search runs only on button click or Enter. Trim input; ignore empty submit.
- Clicking a product tile navigates to `/products/:id`.
- Every data page has **loading, error (with Retry) and empty** states.
- Enquiry form: client-side validation mirroring the API; inline field errors;
  submit disabled while pending; API error shown as an alert; success replaces
  the form with a Thank-you message (and a link back to browse). Honeypot field
  is visually hidden, `tabIndex=-1`, `autoComplete="off"`, `aria-hidden`.
- Accessibility: labelled inputs, `aria-live` status/errors, keyboard operable,
  meaningful `alt` text, visible focus.
- All network calls through `apps/web/src/api/` only; base URL from `VITE_API_URL`.
- Styling via CSS variables in `styles/tokens.css` (colours, spacing, type, radius).
- Components: `Layout`, `ProductCard`, `ProductGrid`, `LoadingState`, `ErrorState`,
  `EmptyState`. Feature folders: `home`, `category`, `search`, `product`, `enquiry`.

## 8. Configuration

All variables are documented in `.env.example` (the reference). The API validates
env with zod at startup and exits with a clear message if invalid. Required to run
with defaults: copy `.env.example` to `.env`.

Docker: web at http://localhost:8080 (nginx, SPA fallback, proxies `/api` to the
api service), api at :4000, Mailpit SMTP :1025 and UI http://localhost:8025.
Dockerfiles are multi-stage, run as non-root, and are AWS (ECS/Fargate) compatible.
No infrastructure code is required for the PoC.

## 9. Testing requirements (critical path)

API (Vitest + Supertest, fixtures, no network):
- `CatalogService`: featured from config; fallback when config invalid; category
  top-rated vs others with no overlap and correct tie-breaks; search match,
  no match, case-insensitive, matches title/description/category; unknown
  category/product.
- `FakeStoreProductRepository` with mocked `fetch`: success, timeout, retry then
  success, 5xx -> `UpstreamError`, invalid payload -> `UpstreamError`, empty body
  for unknown id -> not found, cache hit avoids second fetch.
- `EnquiryService` with fake `EmailSender`: sends once with correct fields,
  unknown product rejected, honeypot sends nothing, HTML escaped, header
  injection stripped, email failure surfaces as `EMAIL_DELIVERY_FAILED`.
- HTTP: each endpoint happy path plus 400/404/502/429 cases; error shape is
  consistent; no stack traces in responses.

Web (Vitest + React Testing Library + MSW):
- Home shows 5 featured products.
- Category page shows both sections.
- Search only fires on submit; empty-results state; empty submit ignored.
- Clicking a product tile navigates to the details page.
- Enquiry: validation errors, successful submit -> Thank you, API failure -> error.
- Loading and error+retry states for at least one page.

## 10. Security and quality basics

helmet; CORS limited to `WEB_ORIGIN`; JSON body limit (e.g. 10kb); zod validation
everywhere; central error handler; rate limit on enquiries; honeypot; HTML-escaped
email; CR/LF stripped from headers; no secrets in repo; env validated; structured
request logging without logging request bodies containing personal data;
containers run as non-root.

## 11. Out of scope (documented cuts)

Authentication/admin UI, database/persistence of enquiries, pagination, i18n,
Playwright/e2e tests, CI pipeline, infrastructure-as-code, customer confirmation
email, analytics, image optimisation.

## 12. Acceptance criteria traceability

| Criterion | API | Web | Tests |
|---|---|---|---|
| Home: 5 featured | `GET /api/products/featured` | `/` | CatalogService + HTTP + Home |
| Category: top rated + additional | `GET /api/categories/:slug` | `/category/:slug` | CatalogService + HTTP + Category |
| Search | `GET /api/products?q=` | `/search?q=` | CatalogService + HTTP + Search |
| Product page | `GET /api/products/:id` | `/products/:id` | HTTP + Product navigation |
| Enquiry: email + thank you | `POST /api/enquiries` | `/products/:id/enquire` | EnquiryService + HTTP + Enquiry form |

## 13. Definition of done

- [ ] All five acceptance criteria demonstrably work
- [ ] `docker compose up` works after `cp .env.example .env`; enquiry email visible in Mailpit
- [ ] `npm test`, `npm run lint`, `npm run typecheck` all pass
- [ ] Web never calls Fake Store (verify with a repo-wide search)
- [ ] No secrets committed; `.env.example` complete
- [ ] README lets a fresh clone run in under 10 minutes
- [ ] DECISIONS.md and AI_USAGE.md completed honestly; time spent recorded
- [ ] PR open from feature branch into `main` with a real description
