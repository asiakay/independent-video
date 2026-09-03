# Independent Video

Independent Video is a modular, creator-first video publishing platform built for one creator first and designed to scale without architectural rewrites.

## Principle

> Build for one real creator. Model for many. Implement only what one needs.

The first milestone is intentionally narrow:

`Creator 001 -> upload -> process -> publish -> permanent watch URL`

## Architecture

The system is organized around four layers:

- `apps/` — human-facing clients such as the public web app and creator studio.
- `modules/` — domain capabilities such as creator, channel, media, and publishing.
- `packages/` — shared technical contracts and utilities.
- `infrastructure/` — provider-specific implementations such as Cloudflare Stream, D1, and R2.

Provider APIs stay behind interfaces. Domain code should depend on capabilities such as `MediaProvider`, not on Cloudflare-specific calls.

## Commit 001 scope

This commit establishes the project contract, initial domain types, provider boundary, TypeScript workspace configuration, architecture notes, and roadmap. It does not implement the UI, database schema, authentication, multi-creator onboarding, or billing.

## Near-term roadmap

1. Creator 001 + Channel 001 persistence
2. Cloudflare Stream adapter
3. Direct upload endpoint
4. D1 video persistence
5. Creator Studio upload screen
6. Public watch page
7. Publish workflow

See `docs/architecture.md` and `docs/roadmap.md` for details.
