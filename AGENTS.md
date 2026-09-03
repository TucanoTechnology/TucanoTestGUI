# AI Agent Rules — Tucano Test GUI

Rules and guidelines for AI agents working on the Tucano Test GUI.

## Shared rules

Organisation-wide rules live in [`AgentRules/`](AgentRules/) and apply to every repository.
Read them before making changes for branching, git usage, dependencies, code review, security,
ticket management and test policy. This file records only what is specific to this repository.

**`AgentRules/` is synced automatically from
[TucanoAgentRules](https://github.com/TucanoTechnology/TucanoAgentRules), the single source of
truth shared with [TucanoTestAPI](https://github.com/TucanoTechnology/TucanoTestAPI). Do not edit
files under `AgentRules/` in this repository — submit changes against TucanoAgentRules instead and
they will arrive here as an automated pull request.**

---

## Core Project Philosophy

**The GUI is a presentation layer and nothing more.**

- All data and operations flow through the TucanoTestAPI HTTP API.
- The GUI never reads the storage volume and never connects to a database.
- No server-side state: the container serves static assets only, so replicas scale independently
  of the API tier.
- **GUI and API are equal citizens** — every action available here must have an API equivalent,
  and every API error must be renderable here.
- If a view needs data the API cannot yet provide, raise an API ticket rather than adding a
  server-side workaround.

---

## Accessibility

**The GUI must meet WCAG 2.1 Level AA.** This is a release gate, not an aspiration.

- `axe-core` runs in CI against the `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` rule tags.
- Any violation fails the build.
- Every interactive control needs a programmatic label and a visible focus indicator.
- Asynchronous status changes must be announced through a live region.
- Keep text contrast at or above 4.5:1, and honour `prefers-reduced-motion`.
- Automated checks are necessary but not sufficient; verify keyboard and screen reader journeys
  manually before release.
- Never suppress an axe rule without recording the justification in the pull request.

---

## Code Standards

### File structure

- Application shell: `src/App.tsx`
- Entry point: `src/main.tsx`
- API client: `src/api/client.ts`
- Styles: `src/styles.css`
- Tests: alongside the code as `*.test.ts` / `*.test.tsx`

### API access

- All requests go through `TucanoApiClient`; do not call `fetch` directly from components.
- Surface the API error envelope (`error.code`, `error.message`) rather than raw responses.
- Never render internal paths, stack traces or storage details.

---

## Testing

Follow the shared unit, contract and Playwright policies in `AgentRules/test/`.

Repository-specific commands:

```sh
npm test           # unit and accessibility tests
npm run typecheck  # TypeScript only
npm run build      # production bundle
```

Accessibility assertions are part of the test suite, not a separate optional step.

---

## Deployment

- Static assets served by unprivileged nginx on port `8080`.
- `/healthz` is the load balancer probe.
- `/api/` is proxied to `TUCANO_API_URL`; the browser never needs the API host directly.
- The image carries no secrets and no writable application state.

---

## Documentation

- Keep `README.md` current with the architecture, accessibility target, prerequisites and commands.
- Record any accessibility exception, with justification, in both the pull request and the README.
