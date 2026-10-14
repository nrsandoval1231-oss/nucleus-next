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
