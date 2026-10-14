# Agent Instructions

## Mission
Build Nucleus Next as a focused GitHub portfolio intelligence and persistent project memory system. Preserve owner-approved vision, verify progress, and keep repositories lean.

## Source of truth
- `docs/PRD.md` is the canonical product specification **once approved**. Do not invent requirements while it is pending.
- GitHub API evidence is authoritative for commits, PRs, reviews, and checks.
- Owner-approved vision and decisions cannot be silently overwritten by inferred information.
- `README.md` provides orientation only.

## Engineering constraints
- Use deterministic code for ingestion, state, and rules; Jev and generative models are optional.
- Keep GitHub access read-only until explicit product authorization changes that boundary.
- Store dynamic project memory centrally, not in `MEMORY.md` files.
- Avoid speculative packages, empty directories, duplicate specifications, and generated progress reports in Git.
- Do not import code from the legacy `Nucleus` repository without explicit approval.
- Add directories only alongside working code and tests.
- Validate changed behavior and report evidence honestly.

## Repository layout (planned, not yet scaffolded)
- `apps/web`: dashboard and API
- `packages/core`: domain logic and deterministic reasoning
- `packages/db`: persistence
- `workers/github-sync`: ingestion and reconciliation
- `docs/PRD.md`: canonical product specification

## Working protocol
Before making changes, read the approved PRD, inspect existing code and tests, make the smallest coherent change, verify it, and report any unresolved limitations. Prefer updating canonical files to creating competing versions.
