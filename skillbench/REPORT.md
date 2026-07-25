# SkillBench: A Benchmark for Professional Knowledge Work — Technical Report (v1 pilot)

*Status: draft for arXiv/technical-report submission. Every number below is computed from
[`results.json`](results.json) as committed; nothing is projected. The result matrix is a
two-model pilot — the headline contribution at this stage is the harness and the honest
negative finding, not a leaderboard.*

## Abstract

Benchmarks exist for code (HumanEval, SWE-bench), knowledge (MMLU), and expert reasoning
(GPQA), but not for the artifacts most knowledge workers actually produce: PRDs,
postmortems, board updates, churn analyses. SkillBench is a reproducible benchmark of 12
frozen professional tasks across 6 domains, scored 1–5 by a version-pinned LLM judge
against a fixed four-dimension rubric. Each task runs twice per model — *bare* (task
only) and *skilled* (task plus a structured SKILL.md instruction file) — yielding a
quality score and a **skill lift** measuring what structured instructions add. In our
two-model pilot (Claude Haiku 4.5, Claude Sonnet 4.6), both models score near the rubric
ceiling bare (4.77 and 4.95 of 5), and mean skill lift is *negative* (−0.27 and −0.35):
under a saturated judge, template-following is penalised on tasks where the brief is
thin. We report this as-is, analyse the ceiling effect, and outline the v2 design
(harder tasks, held-out set, cross-family judging) that the finding motivates.

## 1. Why this benchmark

Most professional work output is a document whose quality is judged by whether a
practitioner could act on it. No public benchmark measures that directly; proxies (MMLU,
chat preference rates) reward knowledge or likability, not whether a postmortem finds
the real root cause. SkillBench fixes the task set, the rubric, and the judge version so
that model comparisons and instruction-quality comparisons are reproducible.

The second question SkillBench asks is unusual: **do structured skills still matter as
models improve?** The library this benchmark grew from ships hundreds of SKILL.md
instruction files; skill lift is the honest way to find out whether they pay their way,
model by model.

## 2. Benchmark design

- **Task set (v1, frozen):** 12 realistic briefs in [`tasks.json`](tasks.json), two per
  domain across product, communication, engineering ops, analysis, strategy, and people.
  Briefs are deliberately messy (fuzzy goals, weak estimates, marginal results) — drawn
  from the library's curated eval corpus of 113 cases.
- **Two conditions per task:** *bare* (the brief alone) and *skilled* (the brief plus
  the corresponding skill's SKILL.md).
- **Judge:** an LLM judge with a pinned model id, disclosed per run in `results.json`,
  scoring 1–5 on four dimensions — structure, completeness, usefulness, grounding —
  averaged over two judge passes.
- **Harness:** [`run-skillbench.mjs`](run-skillbench.mjs) (146 lines, no framework)
  supports Anthropic, OpenAI, and Gemini models via env keys; results append to
  `results.json` with harness and judge versions. Official runs go through a
  manually-dispatched GitHub Action and are reproduced by CI before merging.

## 3. Pilot results (task set v1, judge claude-sonnet-4-6, 2026-07-07)

| Model | Skilled | Bare | Skill lift |
|---|---|---|---|
| claude-sonnet-4-6 | 4.60 | 4.95 | **−0.35** |
| claude-haiku-4-5 | 4.50 | 4.77 | **−0.27** |

Per-domain means (bare → skilled):

| Domain | Haiku 4.5 | Sonnet 4.6 |
|---|---|---|
| Product | 4.50 → 3.38 | 4.88 → 3.50 |
| Communication | 5.00 → 4.38 | 5.00 → 4.25 |
| Engineering ops | 4.88 → 5.00 | 5.00 → 4.88 |
| Analysis | 5.00 → 4.75 | 5.00 → 5.00 |
| Strategy | 4.88 → 4.63 | 4.88 → 5.00 |
| People | 4.38 → 4.88 | 4.94 → 5.00 |

The lift distribution is not uniform. The largest drops concentrate in two tasks for
both models — `prd-template` (−2.50 Haiku, −2.75 Sonnet) and `stakeholder-update`
(−1.25, −1.50) — while `okr-builder` gains for both (+1.00, +0.12) and
`incident-postmortem`/`rice-prioritisation` are flat-to-positive on Haiku.

## 4. What the negative lift actually means

Three effects are entangled, and the pilot cannot fully separate them:

1. **Judge ceiling.** Bare scores of 4.77–4.95 of 5 leave almost no headroom: a skill
   cannot demonstrate lift on a saturated scale, but any friction it introduces shows up
   as loss. A benchmark where frontier models score 96% bare is measuring its own
   ceiling, not the models.
2. **Template-vs-brief mismatch.** The two big losers ask for full structured documents
   from thin briefs. A skill that mandates sections the brief cannot fill pushes the
   model to scaffold thinly or hedge, which the grounding dimension penalises. The
   winners (`okr-builder`, `incident-postmortem`) are tasks where structure *is* the
   hard part.
3. **Same-family judging.** Both runs were judged by claude-sonnet-4-6 — including the
   run where it judged its own outputs. The README's cross-family judging policy exists
   for this reason; the pilot predates an alternative judge being configured.

The practical takeaway for the library itself: on frontier models, a skill earns its
keep by adding *judgment the model lacks* (weighting schemes, blameless framing,
anti-patterns), not by imposing document structure the model already produces. This
finding is already load-bearing for how new skills are reviewed.

## 5. Limitations

- **Two models, one family, one judge** — no cross-vendor comparison yet, and the judge
  shares a family with both candidates.
- **12 tasks** is a floor; single-brief-per-task means task idiosyncrasies dominate
  (one bad template-fit produces most of a domain's swing).
- **LLM-judged:** rubric-anchored and two-pass, but a judge model has tastes; scores
  measure artifact quality against the rubric, not business outcomes.
- **English-only; public task set** (contamination risk grows over time — v2 plans a
  held-out split).

## 6. v2 design (motivated by §4)

Harder briefs with verifiable ground-truth elements (numbers that must reconcile,
constraints that must be honoured); a held-out task split; a cross-family judge panel
with disagreement reporting; more models per release; and per-dimension score reporting
so ceiling effects are visible per axis rather than hidden in a mean.

## 7. Reproduce

```bash
node skillbench/run-skillbench.mjs --models claude-sonnet-4-6 --dry-run   # cost estimate
ANTHROPIC_API_KEY=… node skillbench/run-skillbench.mjs --models claude-sonnet-4-6
```

Task set v1 is frozen in `tasks.json`; every run's judge and harness versions are in
`results.json`.

## Publishing (owner actions)

1. Re-run the harness on at least one non-Anthropic model (OpenAI, Gemini) with a
   cross-family judge before submitting — a single-family pilot is presentable as a
   workshop/technical report, not as a leaderboard paper.
2. arXiv: submit under cs.CL (cross-list cs.AI) as "SkillBench: Measuring Professional
   Knowledge Work"; convert this file via pandoc, add author block and BibTeX for the
   named benchmarks.
3. Link the Hugging Face dataset card (`dataset/`) to this report and vice versa.
4. Suggested license for the task set + results: CC BY 4.0 (code stays under the repo
   license).

*Cite as: SkillBench (pm-claude-skills), task set v1, judge as disclosed in
results.json — https://github.com/mohitagw15856/pm-claude-skills.*
