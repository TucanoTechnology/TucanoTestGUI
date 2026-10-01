# Tucano Test GUI

Accessible web interface for [TucanoTestAPI](https://github.com/TucanoTechnology/TucanoTestAPI).

## Architecture

The GUI is a static single-page application. It holds **no server-side state**, so it scales independently of the API tier — add replicas behind a load balancer without shared storage or sticky sessions.

```text
Browser ──► GUI container (nginx, static assets)
               │
               │ HTTP/JSON
               ▼
          TucanoTestAPI
               │
               ▼
        JSON files on a persistent volume
```

Every read and write goes through the documented API. The GUI never reads the storage volume, never talks to a database, and holds no privileged credentials.

## Modules

The shell lays out as a top bar (brand, project switcher, global search, account), an icon nav rail, and three panes — suite tree on the left, the active module's list in the centre, the selected entity's detail on the right.

| Module | Centre pane | Detail |
| --- | --- | --- |
| Test cases | `src/features/cases/CaseList.tsx` — table scoped by the tree node, with search, bulk tag/status operations, JSON export and case creation; the Last Results column reads `GET /reports/last-results` | `CaseDetail.tsx` — inline-editable header plus Details / Steps / Attachments / History tabs; Details shows the case's read-only defect list |
| Test runs | `src/features/runs/RunList.tsx` — status-summary badges with configuration and tag filters | `RunDetail.tsx` — Cases tab with inline status recording (the record echoes the stored result, painted in place) and the result dialog — where the case's own defect links are fetched from the defects route (TucanoTestAPI#460) — and an Import tab for JUnit/JSON |
| Milestones | `src/features/milestones/MilestoneList.tsx` — five-segment progress bars | `MilestoneDetail.tsx` — edit, duplicate, delete, linked suites/runs |
| Configurations | `src/features/configurations/ConfigurationList.tsx` | `ConfigurationDetail.tsx` |
| Reports | `src/features/reports/ReportsView.tsx` — coverage and summary panels with scope filters | — |

Every list and panel renders the same three non-content states from
`src/components/StateViews.tsx`: `LoadingSkeleton` (a shimmer that respects
`prefers-reduced-motion`), `EmptyState` with its create action where one fits,
and `ErrorState` carrying the API's error code with a retry.

Where the API addresses an entity by its listing key rather than a document id
— runs, milestones and configurations — every control that selects or labels
one shows the key, because a rename never moves it.

## Accessibility

The GUI targets **WCAG 2.1 Level AA**. Conformance is enforced in CI at two levels:

- **Unit** — each component's vitest file runs `axe-core` (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) against the rendered DOM, and `src/styles.test.ts` computes WCAG 1.4.3 ratios for every token pairing the stylesheet relies on, so a palette edit that breaks contrast fails `npm test`.
- **Browser** — `npm run test:e2e` (Playwright + `@axe-core/playwright`, CI job `e2e`) sweeps every page, tab and dialog of the real production bundle and fails on any violation, **including `color-contrast`**, which jsdom cannot evaluate. The run is hermetic: the built bundle is served by `scripts/e2e-static.mjs` against `scripts/e2e-api.mjs`, backed by `e2e/fixtures.json` recorded from a seeded deployment by `scripts/capture-e2e-fixtures.mjs`. The same job verifies the keyboard journeys: skip link, Tab-reachable nav rail, arrow-key tabs and dialog dismissal.

Baseline requirements:

- Semantic landmarks, a skip link and a correct heading hierarchy
- Every control has a programmatic label
- Status changes are announced through an `aria-live` region
- Visible focus indicators, and full keyboard operation
- Text contrast of at least 4.5:1
- `prefers-reduced-motion` respected

Automated testing catches roughly a third of accessibility defects. Manual keyboard and screen reader checks are still required before release.

> The unit-level axe calls still disable `color-contrast` (jsdom has no renderer); that is what the browser job exists to cover. The remaining known limit is that the e2e palette check judges the recorded light theme — a future dark theme (see #170's action list) must extend both contrast tables.

## Design tokens

Colour, spacing, radius, type and layout values live in one token layer at the top of `src/styles.css`.
`src/styles.test.ts` enforces that layer: tokens are declared in `:root`, every `var()` reference
resolves to a declared token, no colour literal appears outside `:root`, and the `--color-` spelling is
used. It deliberately does not require every token to be referenced — tokens are the interface for the
component styles landing in the design-system tickets that follow. See
[docs/design-tokens.md](docs/design-tokens.md) before changing a colour.

## Prerequisites

| Requirement | Version | Purpose |
| --- | --- | --- |
| Node.js | 26 or newer | Build and test the application |
| npm | 11 or newer | Dependency management |
| Docker Engine | 24 or newer | Build and run the container |

## Local development

```sh
npm ci
npm run dev        # development server on http://localhost:5173
npm test           # unit and accessibility tests
npm run test:e2e   # browser accessibility (axe incl. contrast) + keyboard suite
npm run typecheck  # TypeScript only
npm run build      # production bundle
```

Point the application at an API with `VITE_API_BASE_URL`, read once at build time by `src/api/configure.ts`. When unset it calls `/api`, which nginx proxies to `TUCANO_API_URL` in the container.

## API client

Calls to the API go through a client generated from a pinned copy of the TucanoTestAPI OpenAPI document, so the GUI cannot drift from the contract silently. Build it with `createApiClient()` in `src/api/configure.ts`; nothing else should construct HTTP calls.

```sh
npm run generate:client                # regenerate src/api/generated from api/openapi.json
npm run sync:openapi -- --ref <sha>    # move the pin to another TucanoTestAPI revision
```

`src/api/generated/` is committed and never edited by hand — the `client-drift` CI job regenerates it and fails when the committed output is stale. `src/api/client.ts` holds the session around the generated client: the stored token pair, the `apiFetch` wrapper that retries once after a refresh, and the session-expired notification. It does not build requests of its own.

Every action available in the GUI must have an API equivalent, and every API error must be renderable here. When a view needs data the API cannot serve, raise an API issue instead of adding a workaround — the GUI is a display layer and more logic belongs in the API, not less. See [docs/api-client.md](docs/api-client.md).

## Authentication

The login screen exchanges credentials for a bearer token pair via `POST /auth/login`. The access token lives in memory only; the refresh token is stored in `localStorage` and rotated on every refresh, so a refresh token is single-use.

Data requests go through `apiFetch` in `src/api/client.ts`, and the client it hands the caller reads the stored access token once per request — a token stored after the client was built, by a sign-in or by a refresh, is the one the next request carries. A 401 response triggers one refresh-and-retry; concurrent 401s share that one exchange instead of burning the refresh token twice. When the refresh is refused the stored pair is discarded and the app returns to the login screen. Signing out revokes the refresh token with `POST /auth/logout`.

Set `VITE_DEBUG_LOGIN=true` at build time to pre-fill the form and to list the demo accounts below it. The list covers the accounts a seeded TucanoTestAPI deployment can sign in as: `admin`, the bootstrap system administrator, and `viewer`, the account the seed grants ownership of `checkout.json` and no grant on `payments.json`. Their default passwords are `demo-admin-password` and `viewer-seed-password`; pass `VITE_DEMO_ADMIN_PASSWORD` and `VITE_DEMO_VIEWER_PASSWORD` when a deployment seeds its own. The seed creates no `owner` or `editor` account, and the API exposes no way to create one, so the GUI cannot offer those logins.

## Container

```sh
docker build --tag tucano-test-gui .
docker run --rm -p 8080:8080 -e TUCANO_API_URL=http://api:3000 tucano-test-gui
```

The image serves on port `8080` as an unprivileged user. `/healthz` is available for load balancer probes.

## Contribution rules

Repository and agent workflow rules live in [AGENTS.md](AGENTS.md).
