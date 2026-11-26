# Build prompts (run one at a time)

Before Prompt 1, make sure `AGENTS.md`, `SPEC.md` and `.env.example` are committed
on `main`, then create the branch:

```
git checkout -b feature/product-catalogue
```

For every step: paste the prompt, read what the AI produced, run the verify
commands, fix problems, commit. **Log anything the AI got wrong** (for `AI_USAGE.md`).
Save the 3–5 prompts that mattered most.

---

## Prompt 0: Plan first (no code)

```
Read Code Challenge - AI-Native Engineer.pdf, AGENTS.md and SPEC.md fully.
Treat the PDF as authoritative for acceptance criteria and constraints. Do not
write code or edit files yet. Give me:
1) a short build plan in the order of docs/PROMPTS.md,
2) any ambiguities or conflicts between the PDF and SPEC.md, with proposed
   SPEC.md changes to resolve them,
3) the assumptions the PDF leaves open and the reasonable choices you propose,
4) the risks you think are most likely (e.g. Fake Store quirks).
Wait for my answer.
```
Commit: nothing (save the reply for AI_USAGE.md).

## Prompt 1: Scaffold

```
Following AGENTS.md and SPEC.md, scaffold the monorepo: npm workspaces with
apps/api (Express, TypeScript strict, zod, vitest, supertest, tsx for dev) and
apps/web (Vite + React + TypeScript, react-router, @tanstack/react-query, vitest,
React Testing Library, msw). Root scripts: dev, build, test, lint, typecheck.
ESLint + Prettier. A /api/health route only, plus one trivial test in each app
to prove the tooling works. No feature code. Explain each dependency in one line.
```
Verify: `npm install && npm run lint && npm run typecheck && npm test`
Commit: `chore: scaffold monorepo`

## Prompt 2: Domain, data source, services

```
Implement SPEC.md sections 3 (A1, A2, A3, A6, A7, A9), 4 in apps/api:
domain types and the ProductRepository port; FakeStoreProductRepository with zod
validation of upstream data, fetch timeout, bounded retries with backoff,
in-memory TTL cache, empty-body-as-not-found, UpstreamError; slug mapping built
from upstream categories; FeaturedPolicy; CatalogService (getFeatured, getCategory,
search, getProduct, listCategories). Add fixture JSON for tests. Do not add HTTP
routes yet. Config comes from a zod-validated env module.
```
Verify: `npm run typecheck`
Commit: `feat(api): domain, fake store adapter, catalog service`

## Prompt 3: Domain and adapter tests

```
Write the CatalogService and FakeStoreProductRepository tests listed in
SPEC.md section 9. Use fixtures and mocked fetch only. Show me which spec bullet
each test covers.
```
Verify: `npm test`
Commit: `test(api): catalog service and adapter`

## Prompt 4: HTTP layer

```
Implement the routes in SPEC.md section 5 (except enquiries) with thin
controllers calling services; zod validation for params/query; central error
handler producing the shared error shape with the codes in SPEC.md; helmet;
CORS restricted to WEB_ORIGIN; JSON body limit; request logging; ROUTE_NOT_FOUND
handler. Keep buildApp(deps) separate from server.ts. Remember route order for
/products/featured vs /products/:id.
```
Verify: `npm run dev -w apps/api` then curl each endpoint.
Commit: `feat(api): http routes and error handling`

## Prompt 5: Enquiry and email

```
Implement SPEC.md section 6: POST /api/enquiries, EnquiryService, the EmailSender
port, SmtpEmailSender (nodemailer), ConsoleEmailSender (when SMTP_HOST is empty),
HTML escaping, CR/LF stripping, honeypot, route-level rate limiting. In your
reply explain how an AWS SES adapter would plug in (no SES code).
```
Verify: run Mailpit (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`), POST an enquiry, check http://localhost:8025.
Commit: `feat(api): enquiries and email adapters`

## Prompt 6: API tests

```
Write the EnquiryService and HTTP (Supertest) tests listed in SPEC.md section 9,
including 400/404/429/502 cases and error-shape consistency. Inject fakes through
buildApp. No real network or SMTP.
```
Verify: `npm test`
Commit: `test(api): enquiry and http`

## Prompt 7: Web app

```
Implement SPEC.md section 7 in apps/web. Only apps/web/src/api/ may call the
network, using VITE_API_URL. Pages, shared Layout, ProductCard/ProductGrid,
Loading/Error/Empty states, enquiry form with client validation and honeypot,
tokens.css design tokens, accessible markup. Use TanStack Query. Do not put
search/category/featured logic in the web app.
```
Verify: run api + web (`npm run dev`), click through all five acceptance criteria.
Commit: `feat(web): catalogue pages and enquiry form`

## Prompt 8: Web tests

```
Write the web tests listed in SPEC.md section 9 using React Testing Library + MSW.
Tests must not hit the network.
```
Verify: `npm test`
Commit: `test(web): critical user journeys`

## Prompt 9: Docker

```
Add multi-stage Dockerfiles (non-root) for api and web (nginx with SPA fallback
and /api proxied to the api service), docker-compose.yml with web:8080, api:4000,
mailpit (SMTP 1025, UI 8025), and healthchecks, per SPEC.md section 8.
`cp .env.example .env && docker compose up --build` must work with no edits
(SMTP_HOST must resolve to the mailpit service inside compose). Explain how these
images map to AWS ECS/Fargate.
```
Verify: from a **fresh clone** in a new folder, run the two commands and submit an enquiry.
Commit: `chore: docker compose`

## Prompt 10: Adversarial review (do this before docs)

```
Review the whole repo as a strict senior engineer against SPEC.md and AGENTS.md.
List bugs, security issues, any place the web app could call Fake Store directly,
untested critical paths, spec deviations and anything an interviewer could
challenge. Do not fix anything yet; rank findings by severity.
```
Then fix the findings you agree with, one commit each. Also paste the repo into a
second model for an independent review and log what it found.

## Prompt 11: Docs

```
Update README.md (stack choice with reasons, quick start, viewing the enquiry
email in Mailpit, running tests, env vars, structure, how to run locally without
docker) and DECISIONS.md so they match what was actually built. Do not touch
AI_USAGE.md or any time log.
```
You then fill in `AI_USAGE.md` and the time split yourself.

## Final: PR

Push the branch, open a PR into `main` using the template, leave it open.
Re-run the Definition of Done in `SPEC.md` section 13.
