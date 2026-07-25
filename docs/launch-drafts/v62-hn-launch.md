# HN launch kit — the honest-benchmark angle (v62.1)

The strongest HN story this repo has is the one most projects would bury: **we
benchmarked our own product and it lost.** HN rewards exactly this. Everything
below is ready to paste; the only decisions left are the day and the title.

## The post

**Title (pick one, A recommended):**

- A: `Show HN: We benchmarked our 771 AI skills against no skills — skills lost`
- B: `Show HN: PM Skills – 771 open-source SKILL.md files, honestly benchmarked`

**URL:** link the repo (not the playground — HN prefers source).

**First comment (post it yourself, immediately):**

> Author here. PM Skills is 771 MIT-licensed SKILL.md files — plain-markdown
> instructions that teach an AI assistant to do one professional task properly
> (PRDs, postmortems, lease decoding, salary-negotiation practice).
>
> The part I most want feedback on: we built SkillBench to measure whether
> skills actually help, and on frontier models the pilot found *negative* mean
> lift (−0.27 to −0.35 on a 1–5 rubric) — bare models score near the judge's
> ceiling, and template-heavy skills on thin briefs hurt grounding. Full
> analysis, limitations, and the v2 design are in skillbench/REPORT.md. The
> practical takeaway changed how we review skills: encode judgment the model
> lacks (severity scales, decision thresholds, anti-patterns), not structure it
> already produces.
>
> Everything runs client-side or on your own keys; there's a browser playground
> if you want to try a skill without installing anything.

## Runbook

- **When:** Tue–Thu, 14:00–15:00 UTC (morning US East). Never Friday/weekend.
- Post, then immediately add the first comment above. Stay for 4–6 hours and
  answer everything — response quality decides the front page more than the post.
- Do NOT ask anyone to upvote or share the direct HN link anywhere (voting-ring
  detection kills posts). Sharing "we're on HN today" without the link is fine.
- If it doesn't take (<5 points in 2h), it's allowed to try again in a few weeks
  with the other title — one retry is normal, repeated retries are not.

## Comment crib — the questions that will come

- **"Isn't this just prompts?"** → Versioned files that self-activate by
  description, improve by PR, and are auditable — the comparison table is at
  /compare.html. A prompt library is the right tool for personal, occasional use.
- **"Negative lift means your product doesn't work?"** → On *frontier* models,
  on *judge-saturated* tasks, for *structure-heavy* skills — yes, and we said so.
  Lift concentrates where judgment is the hard part (okr-builder, postmortems);
  v2 adds deterministic ground-truth checks so the ceiling can't hide effects.
- **"771 skills can't all be good."** → Correct. Tiers are explicit (50
  Production-Ready with full depth), evals are published per skill, and the
  benchmark report includes what fails.
- **"Security of installing random instructions?"** → Every file is
  pattern-scanned in CI; /scan runs the same scanner on anyone's SKILL.md; and
  the honest limit is stated: a clean scan ≠ safe, read what you install.
- **"Why MIT? What's the business?"** → Skills are judgment and judgment wants
  to be free; paid tiers are services and Org Edition infrastructure, listed in
  docs/SERVICES.md.

## Amplification (same week, not same link)

- r/ClaudeAI + r/ProductManagement: the negative-lift finding as a text post,
  repo linked at the bottom.
- The newsletter + a thread on X: 3 tweets — the finding, the chart, the repo.
- Owner-only: submit the SkillBench report to arXiv first if you want the HN
  post to link a paper — it materially strengthens comment-section credibility.
