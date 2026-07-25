#!/usr/bin/env node
// pm-skills update bot — Dependabot for skills. Scans a consumer repo for
// vendored SKILL.md files, diffs them against the published catalog, and opens
// one PR bumping the stale ones. No dependencies; Node 20+ (built-in fetch).
//
// Detection is content-based, not version-based: many skills carry no
// `version:` frontmatter, but the catalog ships every skill's current body, so
// one catalog fetch finds all drift. Files that differ are refreshed from the
// exact upstream SKILL.md (raw.githubusercontent), never reconstructed.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const env = (k, d = '') => (process.env[k] ?? d).trim();
const PATHS = env('INPUT_PATHS', '.claude/skills,skills').split(',').map((s) => s.trim()).filter(Boolean);
const CATALOG_URL = env('INPUT_CATALOG', 'https://mohitagw15856.github.io/pm-claude-skills/skills.json');
const RAW_BASE = env('INPUT_RAW_BASE', 'https://raw.githubusercontent.com/mohitagw15856/pm-claude-skills/main/skills');
const DRY_RUN = env('INPUT_DRY_RUN') === 'true';
const SKIP = new Set(env('INPUT_SKIP').split(',').map((s) => s.trim()).filter(Boolean));
const BRANCH = env('INPUT_BRANCH', 'pm-skills-update');
const TOKEN = env('INPUT_TOKEN') || env('GITHUB_TOKEN');
const REPO = env('GITHUB_REPOSITORY'); // owner/repo, set by Actions

const fail = (msg) => { console.error('::error::' + msg); process.exit(1); };
const notice = (msg) => console.log('::notice::' + msg);

// Normalise before comparing so CRLF checkouts and trailing whitespace don't
// read as upstream changes.
const norm = (s) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').trim();
const stripFrontmatter = (s) => s.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
const fmName = (s) => (s.match(/^name:\s*(.+)$/m) || [])[1]?.trim();

// 1. Scan the consumer repo for vendored skills.
const found = []; // { name, file }
for (const base of PATHS) {
  if (!existsSync(base) || !statSync(base).isDirectory()) continue;
  for (const dir of readdirSync(base)) {
    const file = join(base, dir, 'SKILL.md');
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const name = fmName(text) || dir;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) { notice(`Skipping ${file}: name "${name}" is not a valid skill id.`); continue; }
    found.push({ name, file, body: norm(stripFrontmatter(text)) });
  }
}
if (!found.length) fail(`No SKILL.md files found under: ${PATHS.join(', ')} — set the "paths" input to where your skills live.`);
console.log(`Scanned ${found.length} vendored skill(s) across ${PATHS.join(', ')}`);

// 2. One catalog fetch answers "what is current" for every skill.
const res = await fetch(CATALOG_URL);
if (!res.ok) fail(`Catalog fetch failed (${res.status}) from ${CATALOG_URL}`);
const catalog = new Map(((await res.json()).skills || []).map((s) => [s.name, s]));

const stale = [], missing = [], skipped = [];
for (const f of found) {
  if (SKIP.has(f.name)) { skipped.push(f.name); continue; }
  const cur = catalog.get(f.name);
  if (!cur) { missing.push(f.name); continue; }
  if (norm(cur.instructions || '') !== f.body) stale.push({ ...f, updated: cur.updated || '?' });
}

console.log(`Up to date: ${found.length - stale.length - missing.length - skipped.length} · stale: ${stale.length} · not in catalog: ${missing.length} · skipped: ${skipped.length}`);
for (const s of stale) console.log(`  stale: ${s.name} (${s.file}) — upstream last updated ${s.updated}`);
for (const m of missing) notice(`"${m}" is not in the catalog — renamed or removed upstream. Left untouched; check the changelog.`);

// Outputs for downstream steps, dry-run or not.
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `stale_count=${stale.length}\nstale=${stale.map((s) => s.name).join(',')}\n`, { flag: 'a' });
}
if (!stale.length) { console.log('Everything current — nothing to do.'); process.exit(0); }
if (DRY_RUN) { console.log('Dry run — no files written, no PR opened.'); process.exit(0); }

// 3. Refresh each stale file from the exact upstream SKILL.md.
const changes = []; // { path, content }
for (const s of stale) {
  const r = await fetch(`${RAW_BASE}/${s.name}/SKILL.md`);
  if (!r.ok) { notice(`Upstream fetch failed for ${s.name} (${r.status}) — skipped this run.`); continue; }
  changes.push({ path: s.file.split(/[\\/]/).join('/'), content: await r.text() });
}
if (!changes.length) fail('All upstream fetches failed — check network / raw_base.');

// 4. Open one PR via the REST API (no git binary needed).
if (!TOKEN || !REPO) {
  // Local / tokenless mode: write in place and stop.
  for (const c of changes) writeFileSync(c.path, c.content);
  console.log(`No token/repo context — updated ${changes.length} file(s) in place instead of opening a PR.`);
  process.exit(0);
}
const api = async (method, path, body) => {
  const r = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'pm-skills-update' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = r.status === 204 ? {} : await r.json();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${j.message || ''} (does the workflow grant contents: write and pull-requests: write?)`);
  return j;
};

const repoInfo = await api('GET', `/repos/${REPO}`);
const base = repoInfo.default_branch;
const baseSha = (await api('GET', `/repos/${REPO}/git/ref/heads/${base}`)).object.sha;
try { await api('POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: baseSha }); }
catch { await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: baseSha, force: true }); }

for (const c of changes) {
  let sha;
  try { sha = (await api('GET', `/repos/${REPO}/contents/${c.path}?ref=${BRANCH}`)).sha; } catch { /* new file */ }
  await api('PUT', `/repos/${REPO}/contents/${c.path}`, {
    message: `chore(skills): update ${c.path.split('/').slice(-2)[0]} from pm-claude-skills`,
    content: Buffer.from(c.content).toString('base64'),
    branch: BRANCH, ...(sha ? { sha } : {}),
  });
}

const body = [
  `Refreshes ${changes.length} vendored skill(s) from [pm-claude-skills](https://github.com/mohitagw15856/pm-claude-skills):`,
  '',
  ...stale.filter((s) => changes.some((c) => c.path === s.file.split(/[\\/]/).join('/'))).map((s) => `- \`${s.name}\` — upstream last updated ${s.updated}`),
  '',
  '**Heads up:** this replaces the vendored files with the current upstream versions. If you edited any of them locally, your edits are in this diff — review before merging, and add those skills to the `skip` input to keep local forks.',
  ...(missing.length ? ['', `Not touched (no longer in the catalog — renamed or removed upstream): ${missing.map((m) => `\`${m}\``).join(', ')}`] : []),
].join('\n');

let pr;
const existing = (await api('GET', `/repos/${REPO}/pulls?head=${REPO.split('/')[0]}:${BRANCH}&state=open`))[0];
if (existing) { pr = existing; await api('PATCH', `/repos/${REPO}/pulls/${existing.number}`, { body }); }
else pr = await api('POST', `/repos/${REPO}/pulls`, { title: `Update ${changes.length} pm-skill(s) to latest`, head: BRANCH, base, body });
console.log(`PR ready: ${pr.html_url || pr.url}`);
if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `pr_url=${pr.html_url || pr.url}\n`, { flag: 'a' });
