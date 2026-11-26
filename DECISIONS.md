# DECISIONS.md

> DRAFT written before coding. Review it, edit it to match what you actually built,
> and be ready to defend every line in the interview.

## Stack choices

| Choice | Why | Alternative considered |
|---|---|---|
| React + Vite + TS | TODO | TODO |
| Node + Express + TS | TODO | TODO (e.g. Fastify, Laravel) |
| zod | One validation approach for env, input and upstream data | hand-rolled checks |
| TanStack Query | Caching, loading/error states, retries | useEffect + fetch |
| Mailpit | Free local inbox, no accounts | MailHog, real SMTP |
| npm workspaces monorepo | One repo, one install, shared tooling | separate repos |

## Assumptions

See `SPEC.md` section 3 (A1–A10) for the full list. Summary:

- Featured products are *chosen* by the entrepreneur via config; missing or
  invalid IDs fall back to the five highest-rated products with a warning (A1)
- Category top rated = top 3 by rating (A2)
- Search is server-side substring match on title, description, category (A3)
- Enquiries are emailed, not persisted; failures are shown honestly (A4)
- Abuse protection: rate limit, honeypot (A5)
- Resilience for the upstream: timeout, retry, cache (A6)

## Requirements dropped or simplified, and why

- No database / persistence of enquiries — email is the only record. Risk: a lost
  email means a lost lead. Next step: outbox table + retry.
- No auth/admin UI — featured products come from config.
- No pagination — ~20 products.
- No e2e tests, CI, IaC — time-box.
- TODO: add anything else you cut during the build.

## How the design supports growth

- **Product data source:** `ProductRepository` port. A new source (database, CMS,
  real catalogue API) = a new adapter + one wiring change. Controllers, services
  and the web app do not change.
- **Email provider:** `EmailSender` port. AWS SES = a new adapter + wiring.
- **Look and feel:** CSS variables in `tokens.css` + shared components, feature
  logic separate from presentation.
- **Frontend/backend boundary:** the web app only talks to our API through one
  module; the API contract is documented in SPEC.md.
- **Deployment:** containers are AWS ECS/Fargate compatible.

## What I would do next with another day

- Persist enquiries (outbox pattern) and retry email delivery
- Admin screen / data store for featured products
- OpenAPI contract + generated shared types between api and web
- Playwright e2e tests and a CI pipeline
- SES adapter, secrets via AWS Secrets Manager, IaC (CDK/Terraform)
- Observability: metrics, tracing, error tracking
- Pagination and richer search (ranking, filters)

## Deviations from SPEC.md during the build

TODO: list anything that changed and why.
