# Artyst Website — CA-026

Demonstration build of the Artyst's website.
Single-file static HTML. Hash-based routing. No build step.

**Status:** Draft v0.5 · demonstration build
**Owner:** Othersyde Ltd / Matthew Taylor
**Domain (planned):** theartyst.co.uk
**Current deployment:** Vercel preview only

---

## What this is

A standalone HTML file (`index.html`) that renders four pages via hash-based
routing:

- `/` · Home
- `#underground` · Crowdfunder campaign page
- `#jobs` · Bar Manager recruitment
- `#admin` · Internal orientation map (hidden — demo only)

All text is placeholder, marked by the persistent demo banner at the top of every
page. The admin directory at `#admin` is reachable by hash URL only and must be
stripped or password-gated before public deployment.

---

## Deployment

This repo is auto-deployed by Vercel on every push to `main`.

To update the live site:
1. Edit `index.html` locally (or via GitHub web UI)
2. Commit + push
3. Vercel deploys within ~30 seconds

No build command, no framework, no dependencies.

---

## Before public deployment, remember to

- [ ] Strip the `#admin` section (clearly bounded by `<!-- ============ ADMIN PAGE ... -->` comments) or convert to server-side password gate using the CA-022 auth-check pattern
- [ ] Fill the motto placeholders in the hero and footer (currently empty HTML comments)
- [ ] Confirm rights clearance for any copyrighted lyrics used (Jugband Blues / Pink Floyd Music Ltd / Barrett estate)
- [ ] Remove the persistent demo banner (`.demo-banner`)
- [ ] Remove `[Placeholder copy — under active revision]` inline markers
- [ ] Update footer version stamp from "demonstration build" to the live version
- [ ] Replace the `https://www.crowdfunder.co.uk/p/the-underground` placeholder URL with the real Crowdfunder campaign URL once live

---

## Related

- CA-022 QR Engine — `go.theartyst.co.uk/admin`
- CA-023 Volunteer Registry — `volunteer.theartyst.co.uk`
- CA-025 Job Engine — `go.theartyst.co.uk/job-engine.html`
- Full orientation map — this site at `#admin`

---

_CA-026 · April 2026 · The Alcademy / Othersyde Ltd_
