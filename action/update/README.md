# 🔄 PM Skills — Update Bot (Dependabot for skills)

Installed skills go stale silently: you `npx pm-claude-skills add` once, the library
keeps improving, and your vendored copies never hear about it. This action closes that
loop — on a schedule it scans your repo for `SKILL.md` files, diffs them against the
published catalog, and opens **one PR** refreshing the stale ones, each line linking
what changed and when.

## Use it

```yaml
# .github/workflows/skill-updates.yml
name: skill-updates
on:
  schedule: [{ cron: '0 6 * * 1' }]   # Mondays
  workflow_dispatch:
permissions:
  contents: write
  pull-requests: write
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mohitagw15856/pm-claude-skills/action/update@main
        with:
          paths: .claude/skills        # where your skills live
          # skip: prd-template         # skills you forked on purpose
          # dry_run: 'true'            # report only, no PR
```

## How it decides

- **Drift is content, not version numbers.** Bodies are compared (whitespace- and
  CRLF-normalised) against the catalog, so skills without a `version:` field are
  covered too. Stale files are refreshed from the exact upstream `SKILL.md` — never
  reconstructed.
- **Local edits are not detected as such** — the action can't tell your edit from an
  upstream change, so an edited skill shows up in the PR diff for you to review.
  Fork a skill on purpose? Add it to `skip`.
- **Renamed/removed upstream:** reported in the PR body, never deleted locally.
- Re-runs update the same branch/PR instead of stacking new ones.

Without a token (running locally: `node action/update/run.mjs`), it updates files in
place instead of opening a PR. Point `catalog`/`raw_base` at your own fork or Org
Edition host to run this against a private library.
