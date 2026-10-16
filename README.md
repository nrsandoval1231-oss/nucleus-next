# Nucleus Next

Nucleus Next is a GitHub portfolio intelligence and persistent engineering memory platform.

**North Star:** Protect the vision. Preserve the knowledge. Verify the progress. Eliminate the clutter.

## Product boundaries

- GitHub is authoritative for repository activity and verification evidence.
- Nucleus maintains project vision, temporal memory, project state, and repository hygiene intelligence.
- Deterministic reasoning is the default; Jev and generative AI are optional.
- GitHub integration starts read-only. No autonomous repository modification.
- Dynamic memory lives in Nucleus, not in per-repository `MEMORY.md` files.
- Nucleus is not a coding harness, deployment engine, or general-purpose operating system.

## Canonical specification

[`docs/PRD.md`](docs/PRD.md) is the canonical product specification. This README documents running the first implementation, not a competing product specification.

## First working slice

The read-only portfolio discovers repositories, shows open-work search coverage, and retrieves detailed evidence on demand: the default-branch commit, exact-SHA check runs and commit statuses, open PRs, recent merges, releases and deployment statuses. Every source exposes observation time, bounded scope, and unavailable/partial states. Individual successful checks never imply an approved verification profile, deployment, owner acceptance, or vision.

Run with Node 22 or later:

```sh
npm ci
npm test
npm run dev
```

Open `http://localhost:4173`. Public discovery works without credentials. Use **Inspect project** to retrieve exact evidence; search, filters, sorting, connection coverage, and evidence links are interactive. Reads cache for five minutes, preserving acquisition timestamps. Public GitHub rate limits may make some reads unavailable; retry times are displayed where provided. When public discovery is rate-limited at the server, a credential-free browser transport reads the same public API through shared ingestion code. That fallback retains evidence only for the browser session and is explicitly labeled; it is never offered for a private runtime. Durable memory still belongs in the central PostgreSQL adapter. Private installation scope is revalidated before every API read, even when detail evidence is cached.

### Private repositories and central retention

The hosted demonstration uses public GitHub discovery and bounded temporary server memory. It does **not** claim complete private-portfolio coverage or durable memory. No connector credentials or private repository snapshots are embedded in the application. Sites app-integration eligibility tooling was unavailable during implementation, so the demo does not declare or emulate a connected GitHub integration.

For private access, configure a dedicated GitHub App installed on selected repositories using the server-side names in `.env.example`. Use metadata, contents, pull requests, actions, checks, commit statuses and deployments **read** permissions only. Supply the App private key in PKCS#8 PEM format. Installation token minting is the only GitHub POST; the transport for repository data has only GET operations. The runtime narrows token grants to read access, keeps credentials server-side, and renews short-lived tokens. The exchange is fixture-tested; real installation authentication remains unverified until configured.

Private API access also requires `NUCLEUS_OWNER_ID` matching the trusted authenticated visitor header. Sites supplies authenticated identity at its private access boundary. The Node adapter binds loopback by default and trusts no browser identity headers; private access requires an authenticating reverse proxy on loopback and explicit `NUCLEUS_TRUST_PROXY=1`. Never expose that adapter directly or forward user-supplied identity headers through the proxy. Managed public-only preview may bind all interfaces when its supervisor passes `--host`; private credentials or database configuration disable that preview behavior.

For durable central evidence, use the Node adapter with `DATABASE_URL`, apply `packages/db/schema.sql`, and provision a single-workspace runtime database role without UPDATE/DELETE permissions on evidence tables. The adapter atomically appends acquisition evidence and projections; it never writes project memory into connected repositories. Configure TLS, backups and operator access on the actual PostgreSQL host. The migration and rollback behavior run against an isolated PostgreSQL engine through PGlite tests; production host connectivity, backup/restore operations and retention capacity are not yet verified. The hosted Worker demo intentionally uses the temporary adapter; it does not silently substitute another database for PostgreSQL.

### Validation and scope

`npm test` runs isolated transport, evidence, authorization, UI DOM interaction, App JWT, and PostgreSQL-engine transaction tests, followed by Cloudflare workerd runtime tests against an isolated provider fixture. Runtime tests exercise actual ambient fetch invocation, discovery/persistence, and App credential exchange without live credentials. `npm run test:live` explicitly reads real public GitHub metadata and writes ignored `.artifacts/live-integration.json`; it never mutates GitHub. `npm run build` bundles the Worker demo with embedded static assets and no browser secrets. Browser screenshot/mobile-layout verification was blocked by the environment's browser policy; DOM tests are not a substitute for that visual acceptance.

This slice advances F01/F04/F05 and portions of A01/A15/A16/A23/A24/A30/A31/A32. It is not full PRD acceptance. It has no webhooks, scheduled reconciliation, history backfill, review-requirement resolution, PR-head checks, approved verification profiles, owner vision approval, acceptance workflow, or product regime classification. Merges are sampled from the 10 most recently updated closed PRs; releases and deployments are sampled to five. Search-index open work may lag the exact repository endpoint. The interface reports those limits rather than calling the portfolio complete.

## Lean source layout

```text
apps/web/              Dashboard and API
packages/core/         Evidence, memory, vision, reasoning, hygiene
packages/db/           PostgreSQL schema and persistence
workers/github-sync/   GitHub ingestion and background reconciliation
docs/PRD.md            Canonical product specification
```

Directories are created when real implementation files are added. Do not add placeholder files merely to display a folder structure.

## Development principles

- Preserve approved vision and historical evidence.
- Separate verified facts from inference and recommendations.
- Prefer small, independently testable modules over speculative abstractions.
- Keep documentation canonical and minimal.
- Never infer product completion from commit activity alone.
