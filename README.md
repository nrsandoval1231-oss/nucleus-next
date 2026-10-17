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

The implementation-ready product specification will live at [`docs/PRD.md`](docs/PRD.md) once authored and reviewed. This README is an orientation, not a competing specification.

## Time Architect UI exploration

**Time Architect / The Living Present** is the owner-selected exploratory interaction direction, governed by [§11.1 of the canonical PRD](docs/PRD.md). It is not a replacement for the required portfolio, evidence, vision, memory, and verification capabilities.

An isolated mobile-first concept lives on [draft PR #4](https://github.com/nrsandoval1231-oss/nucleus-next/pull/4) under `experiments/time-architect/`. It uses illustrative data, not live GitHub state, and its Vercel preview is not the production deployment. The core implementation must follow the PRD's dependency order and hosting architecture. Do not merge the concept as a production feature or claim release readiness based on the prototype.

## Planned lean monorepo

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
