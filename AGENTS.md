# AGENTS.md — Rules for AI coding agents

This file is read automatically by most AI coding tools. If your tool expects a
different filename (e.g. `CLAUDE.md`), copy this file to that name and commit both.

## Project

A product catalogue proof of concept (take-home challenge). Customers browse
featured products, browse by category, search, view a product, and submit an
enquiry that emails a sales inbox.

**The assignment PDF is authoritative for acceptance criteria and constraints.**
Read `Code Challenge - AI-Native Engineer.pdf` and `SPEC.md` fully before writing
code. `SPEC.md` is the detailed implementation plan; if it conflicts with the PDF,
the PDF wins and `SPEC.md` must be reconciled before implementing the affected
requirement.

When the PDF leaves a detail open, make a reasonable assumption, record it in
`SPEC.md` and `DECISIONS.md`, and explain it in the step summary. Do not contact
the assessors to clarify. If an assumption would change a required outcome or is
hard to reverse, pause for the human to review it before implementing dependent
work.

## Stack (fixed — do not change without asking)

- Monorepo, npm workspaces: `apps/api`, `apps/web`
- API: Node.js (22 LTS or newer), TypeScript, Express, zod, nodemailer, helmet,
  cors, express-rate-limit, pino (or similar) for logging
- Web: React, Vite, TypeScript, React Router, TanStack Query
- Tests: Vitest everywhere; Supertest (api); React Testing Library + MSW (web)
- Lint/format: ESLint + Prettier
- Run: `docker compose up` (web via nginx, api, Mailpit as fake SMTP inbox)
- No paid services, no accounts a reviewer would need to create. No secrets in git.

## Architecture rules (non-negotiable)

1. **The web app NEVER calls the Fake Store API.** It only calls our API, and only
   through `apps/web/src/api/` (the single module that does network calls).
2. **Ports and adapters in the API.** Business logic depends on interfaces
   (`ProductRepository`, `EmailSender`), never on Fake Store or nodemailer directly.
   Adapters live in `apps/api/src/adapters/`. Swapping the data source or email
   provider must require writing one new adapter and changing one wiring line.
3. **Controllers are thin.** Routes -> controllers -> services -> ports.
   Controllers parse/validate input and shape output; services hold the logic.
4. **All search, category and featured logic lives in the API**, not the web app.
5. **`buildApp(deps)` is separate from `server.ts`** so tests can inject fakes.
6. **Look and feel is isolated** in `apps/web/src/styles/tokens.css` (CSS variables)
   and shared components, so a redesign does not touch feature logic.
7. **Config is read once, validated with zod at startup**, and passed in. No
   `process.env` access scattered through the code. Fail fast on invalid config,
   except `FEATURED_PRODUCT_IDS`: per SPEC A1, a missing or invalid featured list
   falls back to the five highest-rated products and logs a warning.

## Code standards

- TypeScript `strict: true`. No `any`, no `@ts-ignore` (use `unknown` + narrowing).
- Validate ALL external input with zod (params, query, body, env, upstream data).
- Errors: typed error classes -> one central error handler -> the shared response
  shape in SPEC.md. Never leak stack traces or internals to clients.
- Escape all user-supplied content in HTML email. Strip CR/LF from anything that
  goes into email headers/subject.
- Small functions, descriptive names, no dead code, no commented-out code.
- Comments explain *why*, not *what*.
- Do not add dependencies without stating why in one line.
- Keep it simple. This is a PoC with a foundation that can grow; do not
  over-engineer (no DB, no auth, no microservices, no GraphQL).

## Testing rules

- Cover the critical path (see SPEC.md section 9). Tests must be deterministic.
- **Tests never call the real Fake Store API or a real SMTP server.** Use fixtures,
  fakes and mocked `fetch` / MSW.
- Run lint, typecheck and tests before declaring a step done.

## Working agreement (how to work with the human)

- Work in small steps matching `docs/PROMPTS.md`. After each step:
  1. List the files you created/changed.
  2. Say exactly how to verify (commands to run).
  3. List any assumptions or deviations from SPEC.md.
  4. Stop. Wait for the human to review and commit.
- Do not start the next step on your own.
- If something you generated might be wrong or risky, say so plainly.
- **Never write or edit `AI_USAGE.md` or the time log.** The human records those
  honestly. Never invent entries.
- Never commit or print secrets. `.env` stays out of git; `.env.example` stays in.

## Commands (keep these working; update here if they change)

```
npm install            # install all workspaces
npm run dev            # api + web in watch mode
npm run build          # build all workspaces
npm test               # run all tests
npm run lint           # eslint
npm run typecheck      # tsc --noEmit in each workspace
docker compose up --build
```
