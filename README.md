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

## Accessibility

The GUI targets **WCAG 2.1 Level AA**. Conformance is enforced in CI: `src/App.test.tsx` runs `axe-core` restricted to the `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` rule tags, and the build fails on any violation.

Baseline requirements:

- Semantic landmarks, a skip link and a correct heading hierarchy
- Every control has a programmatic label
- Status changes are announced through an `aria-live` region
- Visible focus indicators, and full keyboard operation
- Text contrast of at least 4.5:1
- `prefers-reduced-motion` respected

Automated testing catches roughly a third of accessibility defects. Manual keyboard and screen reader checks are still required before release.

> **Known gap:** `axe-core` cannot evaluate the colour-contrast rule under jsdom because there is no canvas. Contrast values in `src/styles.css` were chosen to meet AA, but browser-based verification is tracked as a follow-up.

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
npm run typecheck  # TypeScript only
npm run build      # production bundle
```

Point the application at an API with `VITE_API_BASE_URL`. When unset it calls `/api`, which nginx proxies to `TUCANO_API_URL` in the container.

## API client

Calls to the API go through a client generated from a pinned copy of the TucanoTestAPI OpenAPI document, so the GUI cannot drift from the contract silently. Build it with `createApiClient()` in `src/api/configure.ts`; nothing else should construct HTTP calls.

```sh
npm run generate:client                # regenerate src/api/generated from api/openapi.json
npm run sync:openapi -- --ref <sha>    # move the pin to another TucanoTestAPI revision
```

`src/api/generated/` is committed and never edited by hand — the `client-drift` CI job regenerates it and fails when the committed output is stale. `src/api/client.ts` is the older hand-written client; components migrate off it one at a time.

Every action available in the GUI must have an API equivalent, and every API error must be renderable here. When a view needs data the API cannot serve, raise an API issue instead of adding a workaround — the GUI is a display layer and more logic belongs in the API, not less. See [docs/api-client.md](docs/api-client.md).

## Container

```sh
docker build --tag tucano-test-gui .
docker run --rm -p 8080:8080 -e TUCANO_API_URL=http://api:3000 tucano-test-gui
```

The image serves on port `8080` as an unprivileged user. `/healthz` is available for load balancer probes.

## Contribution rules

Repository and agent workflow rules live in [AGENTS.md](AGENTS.md).
