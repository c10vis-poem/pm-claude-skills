# 🏷 White-label partner program — run this library under your brand, for your clients

Consultancies and agencies already deliver "AI enablement" engagements; this program
lets them deliver a **branded, private skill library** — the Org Edition plus their
own methodology skills — as the thing the client keeps. The stack is MIT, so this
program does not sell *permission* (you already have that); it sells what makes a
partner practice work: certification, support, and being findable.

## What a deployment looks like

```
client-acme/
  org/private-skills/           # the partner's methodology + client-specific skills
  org/white-label/branding.json # name, logo, accent — see branding.example.json
  docker compose -f org/compose.yml up
```

The Org server picks up `branding.json` and serves it at `/v1/branding`; the partner's
name and look apply to the playground surface, while the engine underneath stays
upstream — meaning the partner inherits every library update instead of maintaining a
fork. Private skills stay the client's or the partner's per their own contract; the
[update bot](../../action/update/) keeps the curated layer current.

## What partners get (the paid part)

| | |
|---|---|
| **Certification** | Partner engineers pass the private-skill authoring review (SkillSpec L3 + the security scan) on a sample pack; certified partners are listed below |
| **Support** | A priority channel for deployment and upgrade issues, and early notice of breaking changes |
| **Listing** | "Works with pm-skills — Certified Partner" placement in the README/site, with the badge |
| **Delivery kit** | The proposal template, scoping worksheet, and reference architecture used in first-party [services](../../docs/SERVICES.md) engagements |

What partners do *not* get: any exclusivity, any say over the public library, or their
client work entering public rankings — the [Institute rule](../../docs/INSTITUTE.md)
(money never touches judgment) applies to partners exactly as it does to sponsors.

## Rules of the road

- The white-labeled product must state somewhere reasonable that it is built on
  pm-claude-skills (MIT attribution — a footer line satisfies both the license and
  honesty).
- Partners may not represent the *public* library, exam, or benchmark as their own
  work, and may not issue credentials that imitate the Operator's Exam.
- Certification is per-cohort, revocable for shipped work that fails the security
  scan, and re-checked yearly.

## Owner actions to launch

1. Set partner pricing (suggested shape: certification fee + annual listing; support
   bundled) — deliberately not committed to a number in this doc.
2. Draft the partner agreement from [`AGREEMENT-TEMPLATE.md`](AGREEMENT-TEMPLATE.md)
   with an actual lawyer — the template marks the decisions to make.
3. Recruit 1–2 pilot partners from existing Services inquiries; run their
   certification manually before building any automation.
