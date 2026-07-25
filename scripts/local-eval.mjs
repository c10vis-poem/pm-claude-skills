#!/usr/bin/env node
// Local-model eval runner — the same cases and rubric as evals/run-evals.mjs, but
// generation (and by default judging) goes to an OpenAI-compatible LOCAL endpoint
// (Ollama, LM Studio, llamafile), so nothing leaves the machine. This is the
// harness behind the "verified on local models" tier (docs/LOCAL-MODELS.md).
//
//   node scripts/local-eval.mjs --model llama3.1:8b                    # Ollama default port
//   node scripts/local-eval.mjs --model qwen2.5:14b --skills prd-template,okr-builder
//   node scripts/local-eval.mjs --model mistral --judge anthropic:claude-sonnet-4-6
//
//   --endpoint URL    OpenAI-compatible base (default http://localhost:11434/v1)
//   --model NAME      local model id as the server knows it (required)
//   --judge WHO       "local" (default: the same local model judges — fully offline)
//                     or "anthropic:<model>" (needs ANTHROPIC_API_KEY; leaves the machine)
//   --skills a,b,c    subset (default: the smoke set below)
//   --all             every case in evals/cases.json (slow on laptop hardware)
//   --out PATH        results file (default evals/local/results-<model>.json)
//
// The rubric text and score parsing mirror evals/run-evals.mjs — keep them in sync.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(`--${n}`);

const ENDPOINT = (arg('endpoint', 'http://localhost:11434/v1')).replace(/\/$/, '');
const MODEL = arg('model', '');
const JUDGE = arg('judge', 'local');
if (!MODEL) { console.error('Usage: node scripts/local-eval.mjs --model <local-model-id> [--endpoint URL] [--skills a,b] [--all]'); process.exit(1); }

// Small, mixed-domain smoke set: short enough for laptop inference, varied enough
// to expose where small models break (structure-heavy vs judgment-heavy skills).
const SMOKE = ['rice-prioritisation', 'stakeholder-update', 'incident-postmortem', 'okr-builder', 'user-story-writer', 'meeting-notes'];
const only = arg('skills', '') ? arg('skills', '').split(',').map((s) => s.trim()) : has('all') ? null : SMOKE;

const outPath = arg('out', join(root, 'evals', 'local', `results-${MODEL.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`));

const DIMENSIONS = ['structure', 'completeness', 'usefulness', 'grounding'];
const runPrompt = (body) => body + '\n\n---\nExecute this skill now on the input. Output only the finished artifact.';
const judgePrompt = (description, output) => `You are a strict evaluator of a professional work artifact.

The artifact was produced by a skill whose job is:
"${description}"

Score the artifact below from 1 (poor) to 5 (excellent) on each dimension:
- structure: follows a clear, expected structure for this kind of output
- completeness: covers what the task needs, nothing important missing
- usefulness: actually useful to a professional, specific not generic
- grounding: stays grounded in the given input, no invented facts/metrics

Return ONLY a JSON object, no prose: {"structure":N,"completeness":N,"usefulness":N,"grounding":N}

--- ARTIFACT ---
${output}`;

function parseScores(text) {
  const clean = String(text || '').replace(/```[a-z]*|```/gi, '');
  let j = null;
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { j = JSON.parse(m[0]); } catch { /* fall through to regex */ } }
  const s = {};
  for (const d of DIMENSIONS) {
    let v = j && j[d] != null ? Number(j[d]) : NaN;
    if (!(v >= 1)) {
      const mm = clean.match(new RegExp('"?' + d + '"?\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)', 'i'));
      if (mm) v = Number(mm[1]);
    }
    if (!(v >= 1)) throw new Error('judge returned no score for "' + d + '"');
    s[d] = Math.max(1, Math.min(5, v));
  }
  return s;
}

async function localComplete({ system, user, maxTokens = 3000 }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });
  const res = await fetch(`${ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.3 }),
  });
  if (!res.ok) throw new Error(`local endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).choices?.[0]?.message?.content || '';
}

async function anthropicComplete({ model, user, maxTokens = 300 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('--judge anthropic:* needs ANTHROPIC_API_KEY');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: user }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`anthropic: ${j.error?.message || res.status}`);
  return j.content?.[0]?.text || '';
}

const judgeOnce = (prompt) =>
  JUDGE.startsWith('anthropic:') ? anthropicComplete({ model: JUDGE.slice('anthropic:'.length), user: prompt }) : localComplete({ user: prompt, maxTokens: 300 });

// ── main ─────────────────────────────────────────────────────────────────────
// Reachability first, with a clear message — most failures are "no server".
try {
  const ping = await fetch(`${ENDPOINT}/models`).catch(() => null);
  if (!ping || !ping.ok) throw new Error();
} catch {
  console.error(`No OpenAI-compatible server at ${ENDPOINT}.\n` +
    '  Ollama:    ollama serve   (then: ollama pull <model>)\n' +
    '  LM Studio: enable the local server (default http://localhost:1234/v1 — pass --endpoint)\n');
  process.exit(1);
}

const { cases } = JSON.parse(readFileSync(join(root, 'evals', 'cases.json'), 'utf8'));
const picked = cases.filter((c) => !only || only.includes(c.skill));
if (!picked.length) { console.error(`No cases matched: ${only?.join(', ')}`); process.exit(1); }
console.log(`Local eval — model ${MODEL} @ ${ENDPOINT} · judge ${JUDGE} · ${picked.length} case(s)`);
if (JUDGE === 'local') console.log('Note: the model is judging itself — fine for a smoke signal, not for tier verification (see docs/LOCAL-MODELS.md).');

const results = [];
for (const c of picked) {
  const skillPath = join(root, 'skills', c.skill, 'SKILL.md');
  let text;
  try { text = readFileSync(skillPath, 'utf8'); } catch { console.error(`✗ ${c.skill} — no SKILL.md, skipped`); continue; }
  const description = (text.match(/^description:\s*"?(.+?)"?$/m) || [, ''])[1];
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  try {
    const output = await localComplete({ system: runPrompt(body), user: c.input });
    if (!output.trim()) throw new Error('empty output');
    const scores = parseScores(await judgeOnce(judgePrompt(description, output)));
    const overall = Math.round((DIMENSIONS.reduce((a, d) => a + scores[d], 0) / DIMENSIONS.length) * 100) / 100;
    console.log(`✓ ${c.skill} — ${overall.toFixed(2)}/5`);
    results.push({ skill: c.skill, scores, overall, outputChars: output.length });
  } catch (e) {
    console.error(`✗ ${c.skill} — FAILED (${e.message})`);
    results.push({ skill: c.skill, error: e.message });
  }
}

const scored = results.filter((r) => r.overall);
const mean = scored.length ? Math.round((scored.reduce((a, r) => a + r.overall, 0) / scored.length) * 100) / 100 : null;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({
  model: MODEL, endpoint: ENDPOINT, judge: JUDGE, date: new Date().toISOString().slice(0, 10),
  cases: results.length, scored: scored.length, failed: results.length - scored.length, mean, results,
}, null, 2) + '\n');
console.log(`\n${scored.length}/${results.length} scored · mean ${mean ?? 'n/a'} · wrote ${outPath.replace(root + '/', '')}`);
