# Roadmap

## Milestone 001 — Architecture baseline

Establish the repository contract, domain boundaries, provider interface, and project configuration.

Exit condition: the repository clearly answers what belongs in the domain, what belongs in infrastructure, and what the first product slice is.

## Milestone 002 — Creator 001 + Channel 001

Add persistence-ready creator and channel models and seed the first creator/channel identities.

Exit condition: all future videos can be associated with stable creator and channel IDs.

## Milestone 003 — Cloudflare Stream adapter

Implement `MediaProvider` using Cloudflare Stream.

Exit condition: the application layer can request a direct upload without knowing Cloudflare API details.

## Milestone 004 — Direct upload API

Add the Worker endpoint that issues a one-time direct upload URL.

Exit condition: a browser can upload a video directly to the media provider without exposing infrastructure credentials.

## Milestone 005 — D1 video persistence

Persist internal video records separately from provider records.

Exit condition: a video has a stable internal ID, creator ID, channel ID, provider ID, slug, title, status, and timestamps.

## Milestone 006 — Creator Studio upload

Build the smallest creator interface for selecting, uploading, titling, and preparing a video.

## Milestone 007 — Public watch page

Render a permanent canonical watch URL backed by internal metadata and provider playback.

## Milestone 008 — Publish workflow

Connect draft, processing, ready, published, and failed states into one reliable creator workflow.

### First product milestone

`Creator 001 -> upload -> process -> publish -> permanent watch URL`

After that milestone is reliable, expand toward collections, transcripts, search, feeds, audience relationships, native clients, and eventually multi-creator onboarding.
