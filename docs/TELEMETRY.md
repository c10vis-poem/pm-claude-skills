# 📊 Telemetry — opt-in, counts only, stated plainly

The library has always promised *no telemetry*. That stays the default. What exists
now is a strictly **opt-in** usage counter, because tier promotions ("Stable →
Production-Ready") should run on evidence of use, not gut feel — and the only honest
way to get that evidence is to ask for it.

## What is sent, exactly

When — and only when — you set `PM_SKILLS_TELEMETRY=1`, `pm-claude-skills run`
sends one request after a successful run:

```json
POST https://pm-skills-mcp.pm-claude-skills.workers.dev/ping
{ "skill": "prd-template" }
```

That is the entire payload: the skill *name*. No input, no output, no key, no
machine id, no IP retention — the worker increments two counters in KV and discards
the request. The handler is ~15 lines you can read:
[`mcp-remote/src/scan.js`](../mcp-remote/src/scan.js) (`handlePing`).

## What the counts are for

- **Tier promotions** — a Stable skill with real usage is a promotion candidate;
  one nobody runs isn't, no matter how nice it looks.
- **The public counter** — `GET /stats/skills` returns the top skills by opt-in
  count, and feeds a "most-used this month" section when there's enough signal.

## Opt in / out

```bash
export PM_SKILLS_TELEMETRY=1    # opt in (shell profile if you mean it)
unset PM_SKILLS_TELEMETRY       # opt out — also simply never setting it
```

Nothing else in the library sends anything: skills are inert markdown, the
playground runs client-side on your key, and the MCP servers serve content without
logging identity. If you spot a network call this document doesn't cover, that's a
bug — please open an issue.
