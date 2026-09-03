# Architecture

## Goal

Independent Video starts as a single-creator publishing system and grows by adding capabilities, not by replacing its core model.

The first complete vertical slice is:

`Creator -> Channel -> Upload -> Process -> Publish -> Watch`

## Layers

### Apps

User-facing clients. The initial clients will be a public web app and creator studio. Future mobile and TV clients should consume the same application/API layer.

### Modules

Domain logic. Modules express what the system knows how to do without depending directly on infrastructure vendors.

Initial modules:

- `creator`
- `channel`
- `media`
- `publishing`

### Packages

Shared technical contracts and utilities used across apps and modules.

### Infrastructure

Vendor-specific implementations. Cloudflare is the initial infrastructure provider:

- Stream for upload, transcoding, and playback
- D1 for structured platform data
- R2 for portable/archive objects
- Workers for application/API execution

## Domain model

Even with one creator, records should carry stable creator and channel identifiers. This preserves the path to multiple creators without implementing multi-tenant product features prematurely.

The initial conceptual relationships are:

```text
Creator 1 --- * Channel 1 --- * Video
```

A creator may eventually own multiple channels. A channel contains videos. Videos keep internal platform IDs separate from provider IDs.

## Provider boundary

Domain code depends on a media capability interface, not Cloudflare Stream directly.

```text
Publishing / Application Logic
            |
      MediaProvider
            |
   CloudflareStreamAdapter
```

A future media provider can be substituted without changing the public identity or core metadata of a video.

## Ownership rule

Cloudflare IDs are implementation details, not canonical platform IDs. Public URLs, catalog metadata, creator/channel relationships, transcripts, and exportable records remain controlled by Independent Video.

## Non-goals for the first vertical slice

- public creator onboarding
- teams and permissions
- creator payouts
- recommendation algorithms
- complex moderation tooling
- subscriptions and billing
- native mobile clients
- federation

These should be added only when the single-creator system proves the need.
