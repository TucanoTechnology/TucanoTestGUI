# API client

All data and operations reach the GUI through this API, so the client that talks
to it is generated rather than written by hand. A hand-written client drifted
silently from the contract before (see issue #54); a generated one cannot.

## The boundary

```text
api/openapi.json            pinned copy of TucanoTestAPI's contract
api/contract.lock.json      provenance: repo, revision, sha256, operation count, generator version
src/api/generated/**        generator output — never edited by hand
src/api/configure.ts        base URL, token and header wiring for the generated client
src/api/client.ts           legacy hand-written client, being migrated off component by component
```

Everything under `src/api/generated` is replaced wholesale by the generator. Add
configurability in `src/api/configure.ts` or in a component, never in the
generated tree.

## Commands

```sh
npm run sync:openapi              # re-read the pinned revision from TucanoTestAPI
npm run sync:openapi -- --ref <sha>   # move the pin to another revision
npm run generate:client           # regenerate src/api/generated from api/openapi.json
```

`sync:openapi` requires an authenticated `gh` CLI with read access to
`TucanoTechnology/TucanoTestAPI`. It rewrites both `api/openapi.json` and
`api/contract.lock.json`.

The usual change is:

```sh
npm run sync:openapi -- --ref <sha-of-the-API-change>
npm run generate:client
npm test
git add api src/api/generated
git commit -m "chore(api): follow TucanoTestAPI <sha>"
```

## Why the contract is pinned rather than fetched at build time

`generate:client` reads the committed `api/openapi.json`, and refuses to run
when that file no longer matches the hash in `api/contract.lock.json`. That
gives CI a deterministic input, which is what makes the drift check meaningful:
the `client-drift` job regenerates the client and fails if the committed output
differs by even one byte. If the generator fetched "latest" instead, CI would
compare two moving targets and could never fail.

`sync:openapi` is the single intentional step that moves the pin, so a contract
change always shows up as a reviewable diff of `api/` plus `src/api/generated/`.

## Base URL

The browser always calls `/api`; nginx strips that prefix before forwarding to
`TUCANO_API_URL`, and the API serves unprefixed routes. `resolveApiBaseUrl`
defaults to `/api`, and `VITE_API_BASE_URL` overrides it for local development
or embedding. Trailing slashes are stripped so paths are never joined as `//`.

## Configurations are reached through their project

Issue #54 lists `listConfigurations` and `createConfiguration`. Neither exists
in the contract: TucanoTestAPI removed the global collection routes from
`openapi.json` together with the global creates, leaving only `GET`, `PUT` and
`DELETE /configurations/{id}`. The routes are still served — reads are global by
design — but they sit in `api::UNDOCUMENTED_ROUTES` in that repository's
`src/api/mod.rs`, so the contract does not publish them and the generator cannot
emit them. This was a deliberate API decision (TucanoTestAPI#222), not a stale
pin and not a GUI gap.

Creating and listing moved to the project that owns the configuration:

| #54 asked for | Documented operation |
| --- | --- |
| `listConfigurations` | `listProjectConfigurations` — `GET /projects/{id}/configurations` |
| `createConfiguration` | `addProjectConfiguration` — `POST /projects/{id}/configurations` |

`src/api/contract.test.ts` records the pairing in `RETIRED_GLOBAL_COLLECTIONS`
and asserts both halves: the retired operations must stay absent from the
document, their replacements must stay present, and the replacements must sit
under `/projects/{id}/`. If TucanoTestAPI re-publishes a global collection route,
those tests fail and the table has to be revisited.

The same retirement applies to `/test_suites`, `/test_cases`, `/test_runs` and
`/milestones`. No global listing operation exists for any of them, so a view that
lists a resource lists it per project.
