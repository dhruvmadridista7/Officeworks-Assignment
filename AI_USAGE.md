# AI_USAGE.md

> This file is written by ME, honestly, during the build. Do not let the AI fill it in.

## Tools and models

- Coding agent: GPT-6 Luna in VS Code (TODO: confirm tool/extension and model/effort settings)
- Planning and review: Claude Sonnet 5.5 (chat)
- TODO: any other tools

## Agent instruction files (committed)

- `AGENTS.md` (TODO: also `CLAUDE.md` if added)

## Plan / spec

- `SPEC.md` and `docs/PROMPTS.md` were written before any code, with Claude as a
  planning aid. I reviewed and edited them. TODO: note what I changed.

## Key prompts and moments (3–5)

1. TODO: prompt / what it produced / why it mattered
2.
3.

## Where the AI got something wrong, and how I caught it

| # | What went wrong | How I caught it | What I did |
|---|---|---|---|
| 1 | TODO | | |
| 2 | | | |
| 3 | | | |

Things to check on purpose: web calling Fake Store directly, `any` types, wide-open
CORS, unescaped email HTML, missing fetch timeout, logic in the frontend, category
slug bugs (`men's clothing`), tests hitting the live API, committed `.env`, route
order (`/products/featured` vs `/products/:id`), Docker only working locally.

## Independent review

TODO: second-model review findings and what I acted on.

## Time spent

| Activity | Time |
|---|---|
| Planning | |
| Building | |
| Testing | |
| Reviewing | |
| **Total** | |
