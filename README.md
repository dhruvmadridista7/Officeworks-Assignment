# Product Catalogue PoC

> DRAFT — to be completed after the build (Prompt 11). Every command below must be
> verified from a fresh clone before submitting.

A product catalogue (React + Node.js, TypeScript) where customers browse featured
products, browse by category, search, view a product and submit an enquiry that
emails the sales inbox.

## Stack and why

- **Client:** React + Vite + TypeScript — TODO: reasons
- **Backend:** Node.js + Express + TypeScript — TODO: reasons
- **Email (local):** Mailpit fake SMTP inbox — no accounts or paid services
- **Product data:** Fake Store API, only ever called by the backend

## Quick start (Docker)

```
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:8080
- API: http://localhost:4000/api/health
- Enquiry emails (Mailpit): http://localhost:8025

## Run without Docker

TODO: verify and document (Node version, `npm install`, `npm run dev`, Mailpit).

## Tests

```
npm test
npm run lint
npm run typecheck
```

## Configuration

All environment variables are documented in `.env.example`.

## Project structure

See `SPEC.md` section 2. TODO: add final tree.

## Docs

- `SPEC.md` — requirements, assumptions, API contract
- `DECISIONS.md` — decisions, cuts, growth path, next steps
- `AI_USAGE.md` — how AI was used
- `AGENTS.md` — instructions given to the AI coding agent

## Time spent

TODO: actual time (planning / building / testing / reviewing).
