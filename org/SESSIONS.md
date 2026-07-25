# 🤝 Shared sessions — the Org Edition's multiplayer layer

A session is one skill run — input and artifact — that a teammate can open by link,
comment on, and approve. The loop the playground couldn't close: PM drafts the PRD,
design and eng review *in the same place*, and "approved" means something because
editing the artifact reopens review.

```bash
node org/server.mjs          # sessions are on by default at /v1/sessions
```

## The flow

1. **Create** — from the API (the playground posts here after a run, or curl):
   ```bash
   curl -X POST localhost:8080/v1/sessions \
     -d '{"title":"Referral PRD","skill":"prd-template","artifact":"…","author":"mo"}'
   # → { "id": "…", "url": "/session/<id>" }
   ```
2. **Share the link** — `/session/<id>` is a self-contained review page: artifact,
   comment thread, Approve / Request changes buttons. First comment moves the session
   `draft → in-review`.
3. **Approve** — status becomes `approved` and is logged in the thread.
4. **Revise** — posting a new artifact snapshots the old one to `revisions` (last 20)
   and flips `approved → in-review`: approval always refers to a specific text.

## API

| Call | Does |
|---|---|
| `POST /v1/sessions` | create — `{title, skill, input, artifact, author}` |
| `GET /v1/sessions` | list (newest first, comment counts) |
| `GET /v1/sessions/:id` | full session |
| `POST /v1/sessions/:id/comments` | `{author, text, quote?}` |
| `POST /v1/sessions/:id/status` | `{by, status}` — draft · in-review · approved · changes-requested |
| `POST /v1/sessions/:id/artifact` | `{by, artifact}` — snapshots the old, reopens review |

## Trust model & storage

Same as the rest of the Org server, stated plainly: **no accounts** — names are
self-reported, and anyone on the network can approve. That is the same trust level as
your wiki; put the server behind your VPN/SSO proxy. Storage is one JSON file per
session in `org/sessions-data/` (override: `--sessions-data` / `SESSIONS_DATA`) — no
database, trivially backed up, delete a file to delete a session.

## Not built yet (deliberately)

Playground UI integration (a "Share for review" button after a run), inline
text-anchored comments, and notification hooks (a webhook per status change) are the
natural next steps — the API above already supports all three consumers.
