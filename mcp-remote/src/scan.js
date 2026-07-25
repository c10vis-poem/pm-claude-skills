// SkillScan — the library's security-pattern scan, offered as a service for ANY
// public SKILL.md: GET /scan?url=… returns a findings report, /scan/badge a
// shields endpoint, so every skill author can wear (or check) the same bar the
// core library holds itself to.
//
// The RULES mirror scripts/skill-audit.mjs — keep them in sync when patterns
// change there. Only GitHub-hosted raw files are fetched (SSRF containment).

export const RULES = [
  { id: 'inject.ignore', severity: 'high', why: "Tries to override the model's prior/system instructions.",
    re: /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|all|earlier|system)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?|guidelines?)/i },
  { id: 'inject.devmode', severity: 'high', why: 'Jailbreak framing (developer mode / DAN / no restrictions).',
    re: /\b(developer mode|do anything now|\bDAN\b|jailbreak|no (restrictions|guardrails|filters)|without (any )?(restrictions|limitations))\b/i },
  { id: 'inject.reveal', severity: 'high', why: 'Tries to extract the system prompt / hidden instructions.',
    re: /\b(reveal|print|show|repeat|output)\b[^.\n]{0,30}\b(system prompt|your (instructions|system message|initial prompt)|hidden (instructions|prompt))/i },
  { id: 'inject.persona', severity: 'medium', why: 'Forces an unconstrained persona override.',
    re: /\byou are now\b[^.\n]{0,40}\b(unrestricted|unfiltered|amoral|evil|no rules)\b/i },
  { id: 'exfil.send', severity: 'high', why: 'Instructs sending user/conversation data to an external endpoint.',
    re: /\b(send|post|upload|transmit|exfiltrate|forward)\b[^.\n]{0,40}\b(to )?(https?:\/\/|webhook|api\.|endpoint|server)\b[^.\n]{0,40}\b(conversation|messages?|data|credentials?|keys?|tokens?|history)/i },
  { id: 'exfil.beacon', severity: 'medium', why: 'Network call to a hardcoded external URL inside content.',
    re: /\b(curl|wget|fetch\(|requests\.(get|post)|urllib|http\.client)\b[^.\n]{0,60}https?:\/\/(?!localhost|127\.0\.0\.1|\[|[a-z0-9.-]*example\.(com|org))/i },
  { id: 'exec.dynamic', severity: 'medium', why: 'Executes dynamically-built code/commands.',
    re: /\b(eval|exec)\s*\(|\bos\.system\s*\(|subprocess\.(run|call|Popen)\s*\(|child_process|\bFunction\s*\(\s*['"`]/ },
  { id: 'exec.destructive', severity: 'high', why: 'Destructive shell command.',
    re: /\brm\s+-rf\s+(\/|~|\$HOME|\*)|\b(mkfs|dd\s+if=)|\b:\(\)\s*\{\s*:\|:&\s*\}|\bchmod\s+-R?\s*777\s+\// },
  { id: 'secret.aws', severity: 'high', why: 'Looks like a hardcoded AWS access key.', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'secret.private-key', severity: 'high', why: 'Embedded private key.', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: 'secret.harvest', severity: 'medium', why: 'Asks the user/model to hand over secrets.',
    re: /\b(send|share|paste|provide|enter)\b[^.\n]{0,30}\b(your )?(api[_ ]?key|password|secret|access token|ssh key|private key|seed phrase)\b/i },
  { id: 'hidden.zerowidth', severity: 'high', why: 'Contains zero-width / invisible Unicode (can hide instructions).',
    re: /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/ },
  { id: 'hidden.base64blob', severity: 'medium', why: 'Long base64 blob (possible hidden payload).',
    re: /\b[A-Za-z0-9+/]{220,}={0,2}\b/ },
];

export function scanText(text) {
  const findings = [];
  const lines = text.split('\n');
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(rule.re);
      if (m) { findings.push({ line: i + 1, id: rule.id, severity: rule.severity, why: rule.why, snippet: lines[i].trim().slice(0, 120) }); break; }
    }
    if (rule.id === 'hidden.zerowidth' && !findings.some((f) => f.id === rule.id) && rule.re.test(text)) {
      findings.push({ line: 0, id: rule.id, severity: rule.severity, why: rule.why, snippet: '(invisible characters)' });
    }
  }
  const high = findings.filter((f) => f.severity === 'high').length;
  const medium = findings.filter((f) => f.severity === 'medium').length;
  return { findings, high, medium, verdict: high ? 'fail' : medium ? 'advisory' : 'clean' };
}

// Normalise a GitHub URL to its raw form; refuse anything not GitHub-hosted.
function rawUrl(input) {
  let u;
  try { u = new URL(input); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (u.hostname === 'raw.githubusercontent.com') return u.href;
  if (u.hostname === 'github.com') {
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  }
  if (u.hostname === 'gist.githubusercontent.com') return u.href;
  return null;
}

const MAX_BYTES = 300 * 1024;

export async function handleScan(url, jsonResponse, CORS) {
  const target = url.searchParams.get('url') || '';
  const badge = url.pathname === '/scan/badge';
  const shield = (message, color) => new Response(
    JSON.stringify({ schemaVersion: 1, label: 'SkillScan', message, color }),
    { headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=3600, max-age=600', ...CORS } });

  const raw = rawUrl(target);
  if (!raw) {
    const msg = 'Pass ?url= pointing at a GitHub-hosted SKILL.md (github.com blob link or raw.githubusercontent.com). Other hosts are not fetched.';
    return badge ? shield('bad url', 'lightgrey') : jsonResponse({ error: msg }, 400);
  }
  let res;
  try { res = await fetch(raw, { cf: { cacheTtl: 600, cacheEverything: true } }); } catch { res = null; }
  if (!res || !res.ok) return badge ? shield('fetch failed', 'lightgrey') : jsonResponse({ error: `Upstream fetch failed (${res ? res.status : 'network'})`, source: raw }, 502);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return badge ? shield('file too large', 'lightgrey') : jsonResponse({ error: `File exceeds ${MAX_BYTES / 1024}KB scan cap.` }, 413);
  const text = new TextDecoder().decode(buf);

  const report = scanText(text);
  if (badge) {
    const msg = report.verdict === 'clean' ? '✓ clean' : report.verdict === 'advisory' ? `${report.medium} advisory` : `✗ ${report.high} high`;
    return shield(msg, report.verdict === 'clean' ? 'brightgreen' : report.verdict === 'advisory' ? 'yellow' : 'red');
  }
  return jsonResponse({
    source: raw, bytes: buf.byteLength, ...report,
    note: 'Pattern scan only — a clean result means none of the known-bad patterns matched, not that the skill is safe. Read what you install: the skill-vetting skill is the human half of this check.',
    badge: `https://img.shields.io/endpoint?url=${encodeURIComponent(url.origin + '/scan/badge?url=' + encodeURIComponent(target))}`,
  });
}

// ── Opt-in usage telemetry: counts only, nothing else ────────────────────────
// POST /ping {skill} increments two KV counters. No IP, no UA, no payload kept.
// Senders are explicitly opt-in (CLI: PM_SKILLS_TELEMETRY=1). Fails silent-closed
// when KV is absent. GET /stats/skills returns the top counters, public.
export async function handlePing(request, env, jsonResponse) {
  if (!env.TRY_KV) return jsonResponse({ ok: false, note: 'telemetry not configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'bad json' }, 400); }
  const skill = String(body.skill || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(skill)) return jsonResponse({ error: 'bad skill name' }, 400);
  const key = `use:${skill}`;
  const [n, total] = await Promise.all([env.TRY_KV.get(key), env.TRY_KV.get('use:__total')]);
  await Promise.all([
    env.TRY_KV.put(key, String(+(n || 0) + 1)),
    env.TRY_KV.put('use:__total', String(+(total || 0) + 1)),
  ]);
  return jsonResponse({ ok: true });
}

export async function handleStats(env, jsonResponse) {
  if (!env.TRY_KV) return jsonResponse({ skills: [], note: 'telemetry not configured' });
  const list = await env.TRY_KV.list({ prefix: 'use:', limit: 1000 });
  const rows = [];
  for (const k of list.keys) {
    if (k.name === 'use:__total') continue;
    rows.push({ skill: k.name.slice(4), count: +((await env.TRY_KV.get(k.name)) || 0) });
  }
  rows.sort((a, b) => b.count - a.count);
  const total = +((await env.TRY_KV.get('use:__total')) || 0);
  return jsonResponse({ total, note: 'Opt-in pings only (PM_SKILLS_TELEMETRY=1) — counts, never content.', skills: rows.slice(0, 50) });
}
