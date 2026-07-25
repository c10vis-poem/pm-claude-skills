// MCP Apps widgets — interactive HTML views for three flagship outputs, served
// as ui:// resources and linked to render_* tools. Clients that support the MCP
// Apps extension (Claude, ChatGPT) render the widget in a sandboxed iframe and
// hydrate it with the tool's structuredContent; every other client still gets
// the plain-text + structured result, so nothing regresses.
//
// Interop note: the extension's _meta key names were still settling when this
// shipped. Tools carry both the OpenAI Apps key ("openai/outputTemplate") and
// the MCP Apps key ("ui/resourceUri"); widgets accept data from
// window.openai.toolOutput, a postMessage payload, or an embedded fallback.
// Check the current spec at modelcontextprotocol.io before changing the keys.

const STYLE = `
:root { --fg:#1a1a2e; --bg:#fff; --muted:#667; --line:#e3e3ec; --card:#f7f7fb; }
@media (prefers-color-scheme: dark) { :root { --fg:#e8e8f0; --bg:#16161f; --muted:#99a; --line:#2c2c3a; --card:#1e1e2a; } }
* { box-sizing:border-box; margin:0; }
body { font:14px/1.45 system-ui,-apple-system,sans-serif; color:var(--fg); background:var(--bg); padding:16px; }
h1 { font-size:16px; margin-bottom:2px; } .sub { color:var(--muted); font-size:12px; margin-bottom:14px; }
table { border-collapse:collapse; width:100%; } th,td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); }
th { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
.bar { height:8px; border-radius:4px; background:var(--line); overflow:hidden; } .bar i { display:block; height:100%; border-radius:4px; }
.pill { display:inline-block; padding:2px 10px; border-radius:999px; font-weight:600; font-size:12px; color:#fff; }
input[type=number] { width:64px; padding:3px 6px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--fg); }
`;

// Shared bootstrap: render(data) is called with the tool's structuredContent,
// wherever the host chooses to deliver it.
const BOOT = `
function boot(render, demo) {
  let rendered = false;
  const go = (d) => { if (d) { rendered = true; render(d); } };
  window.addEventListener('message', (e) => {
    const m = e.data || {};
    go(m.structuredContent || m.toolOutput || (m.type && m.payload) || null);
  });
  if (window.openai) {
    go(window.openai.toolOutput);
    if (typeof window.openai.subscribe === 'function') window.openai.subscribe('toolOutput', go);
  }
  setTimeout(() => { if (!rendered) render(demo); }, 300);
}`;

const page = (title, body, script) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head><body>${body}<script>${BOOT}\n${script}</script></body></html>`;

// ── 1. Customer health scorecard ─────────────────────────────────────────────
const SCORECARD_HTML = page('Health scorecard', `<div id="app"></div>`, `
const RAG = { red:'#d64545', amber:'#d69a2d', green:'#2d9a5c' };
function render(d) {
  const rag = (d.rag || (d.score >= 70 ? 'green' : d.score >= 45 ? 'amber' : 'red')).toLowerCase();
  document.getElementById('app').innerHTML =
    '<h1>' + (d.account || 'Account') + ' <span class="pill" style="background:' + (RAG[rag] || RAG.amber) + '">' +
    rag.toUpperCase() + ' · ' + Math.round(d.score) + '/100</span></h1>' +
    '<div class="sub">Weighted health score across ' + (d.dimensions || []).length + ' dimensions</div>' +
    '<table><tr><th>Dimension</th><th style="width:45%">Score</th><th>Weight</th></tr>' +
    (d.dimensions || []).map((x) =>
      '<tr><td>' + x.name + '</td><td><div class="bar"><i style="width:' + x.score + '%;background:' +
      (x.score >= 70 ? RAG.green : x.score >= 45 ? RAG.amber : RAG.red) + '"></i></div></td><td>' +
      Math.round((x.weight || 0) * 100) + '%</td></tr>').join('') + '</table>' +
    ((d.risks || []).length ? '<div class="sub" style="margin-top:12px">Top risks</div><ul style="padding-left:18px">' +
      d.risks.map((r) => '<li>' + r + '</li>').join('') + '</ul>' : '');
}
boot(render, { account: 'Example Corp', score: 58, rag: 'amber',
  dimensions: [ { name: 'Product usage', score: 62, weight: 0.3 }, { name: 'Support health', score: 40, weight: 0.2 },
    { name: 'Relationship', score: 75, weight: 0.2 }, { name: 'Commercial', score: 55, weight: 0.3 } ],
  risks: ['Champion left in May', 'Ticket volume doubled quarter-over-quarter'] });
`);

// ── 2. RICE prioritisation matrix (editable, live re-ranking) ────────────────
const RICE_HTML = page('RICE matrix', `<h1>RICE prioritisation</h1>
<div class="sub">Score = Reach × Impact × Confidence ÷ Effort. Edit any cell — ranking updates live.</div><div id="app"></div>`, `
let items = [];
const score = (x) => (x.reach * x.impact * x.confidence) / Math.max(x.effort, 0.1);
function render(d) { items = (d.items || []).map((x) => ({ ...x })); draw(); }
function draw() {
  const ranked = items.map((x, i) => ({ x, i, s: score(x) })).sort((a, b) => b.s - a.s);
  document.getElementById('app').innerHTML =
    '<table><tr><th>#</th><th>Initiative</th><th>Reach</th><th>Impact</th><th>Conf.</th><th>Effort</th><th>Score</th></tr>' +
    ranked.map((r, rank) => '<tr><td>' + (rank + 1) + '</td><td>' + r.x.name + '</td>' +
      ['reach', 'impact', 'confidence', 'effort'].map((f) =>
        '<td><input type="number" step="any" value="' + r.x[f] + '" onchange="upd(' + r.i + ',\\'' + f + '\\',this.value)"></td>').join('') +
      '<td><b>' + r.s.toFixed(1) + '</b></td></tr>').join('') + '</table>';
}
function upd(i, f, v) { items[i][f] = +v || 0; draw(); }
boot(render, { items: [ { name: 'Self-serve onboarding', reach: 4000, impact: 2, confidence: 0.8, effort: 3 },
  { name: 'SSO', reach: 800, impact: 3, confidence: 1, effort: 2 },
  { name: 'Usage dashboard', reach: 2500, impact: 1, confidence: 0.7, effort: 1 } ] });
`);

// ── 3. Roadmap timeline ──────────────────────────────────────────────────────
const ROADMAP_HTML = page('Roadmap', `<div id="app"></div>`, `
const COLORS = { done:'#2d9a5c', building:'#4a6cf5', planned:'#99a', 'at-risk':'#d64545' };
function render(d) {
  const qs = d.quarters || [];
  document.getElementById('app').innerHTML = '<h1>' + (d.title || 'Roadmap') + '</h1><div class="sub">' +
    Object.entries(COLORS).map(([k, c]) => '<span class="pill" style="background:' + c + ';margin-right:6px">' + k + '</span>').join('') + '</div>' +
    '<table><tr><th>Lane</th>' + qs.map((q) => '<th>' + q + '</th>').join('') + '</tr>' +
    (d.lanes || []).map((l) => '<tr><td><b>' + l.name + '</b></td>' + qs.map((q) =>
      '<td>' + (l.items || []).filter((it) => it.quarter === q).map((it) =>
        '<div style="border-left:3px solid ' + (COLORS[it.status] || COLORS.planned) + ';padding:2px 6px;margin:2px 0;background:var(--card);border-radius:4px">' +
        it.title + '</div>').join('') + '</td>').join('') + '</tr>').join('') + '</table>';
}
boot(render, { title: 'H2 roadmap', quarters: ['Q3', 'Q4'],
  lanes: [ { name: 'Growth', items: [ { title: 'Referral program', quarter: 'Q3', status: 'building' },
      { title: 'Pricing revamp', quarter: 'Q4', status: 'planned' } ] },
    { name: 'Platform', items: [ { title: 'Audit log', quarter: 'Q3', status: 'done' },
      { title: 'EU region', quarter: 'Q4', status: 'at-risk' } ] } ] });
`);

export const WIDGETS = {
  'ui://widget/health-scorecard.html': { title: 'Customer health scorecard', html: SCORECARD_HTML },
  'ui://widget/rice-matrix.html': { title: 'RICE prioritisation matrix', html: RICE_HTML },
  'ui://widget/roadmap.html': { title: 'Roadmap timeline', html: ROADMAP_HTML },
};

// Both key spellings on purpose — see the interop note at the top of this file.
const uiMeta = (uri) => ({ 'openai/outputTemplate': uri, 'ui/resourceUri': uri });
const RENDER = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const UI_TOOLS = [
  {
    name: 'render_health_scorecard',
    title: 'Render a health scorecard',
    description:
      'Render a customer health scorecard as an interactive widget (RAG status, weighted dimension bars, top risks). ' +
      'Compute the inputs with the cs-health-scorecard skill, then pass them here for display.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        account: { type: 'string', description: 'Account name.' },
        dimensions: { type: 'array', description: 'Scored dimensions.', items: { type: 'object', additionalProperties: false, properties: {
          name: { type: 'string' }, score: { type: 'number', minimum: 0, maximum: 100 }, weight: { type: 'number', minimum: 0, maximum: 1 } }, required: ['name', 'score'] } },
        risks: { type: 'array', items: { type: 'string' }, description: 'Top risks, one line each.' },
      },
      required: ['account', 'dimensions'],
    },
    annotations: { title: 'Render a health scorecard', ...RENDER },
    _meta: uiMeta('ui://widget/health-scorecard.html'),
  },
  {
    name: 'render_rice_matrix',
    title: 'Render a RICE matrix',
    description:
      'Rank initiatives by RICE (Reach x Impact x Confidence / Effort) and render an editable widget with live re-ranking. ' +
      'The ranked list also comes back as structured output for non-UI clients.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { items: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, properties: {
        name: { type: 'string' }, reach: { type: 'number', description: 'People/accounts affected per period.' },
        impact: { type: 'number', description: 'Impact per person (0.25 minimal - 3 massive).' },
        confidence: { type: 'number', minimum: 0, maximum: 1 }, effort: { type: 'number', description: 'Person-months.' } },
        required: ['name', 'reach', 'impact', 'confidence', 'effort'] } } },
      required: ['items'],
    },
    annotations: { title: 'Render a RICE matrix', ...RENDER },
    _meta: uiMeta('ui://widget/rice-matrix.html'),
  },
  {
    name: 'render_roadmap',
    title: 'Render a roadmap timeline',
    description: 'Render a quarter-by-lane roadmap widget. Items carry a status: done, building, planned, or at-risk.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string' },
        quarters: { type: 'array', minItems: 1, items: { type: 'string' }, description: 'Column labels in order, e.g. ["Q3", "Q4"].' },
        lanes: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, properties: {
          name: { type: 'string' }, items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
            title: { type: 'string' }, quarter: { type: 'string' }, status: { type: 'string', enum: ['done', 'building', 'planned', 'at-risk'] } },
            required: ['title', 'quarter'] } } }, required: ['name'] } },
      },
      required: ['quarters', 'lanes'],
    },
    annotations: { title: 'Render a roadmap timeline', ...RENDER },
    _meta: uiMeta('ui://widget/roadmap.html'),
  },
];

export function runUiTool(name, args) {
  if (name === 'render_health_scorecard') {
    const dims = args.dimensions || [];
    const hasWeights = dims.some((d) => d.weight);
    const total = hasWeights ? dims.reduce((n, d) => n + (d.weight || 0), 0) || 1 : dims.length || 1;
    const score = hasWeights
      ? dims.reduce((n, d) => n + d.score * (d.weight || 0), 0) / total
      : dims.reduce((n, d) => n + d.score, 0) / total;
    const rag = score >= 70 ? 'green' : score >= 45 ? 'amber' : 'red';
    const structured = { account: args.account, score: Math.round(score), rag, dimensions: dims, risks: args.risks || [] };
    return { text: `${args.account}: ${Math.round(score)}/100 (${rag.toUpperCase()})\n` + dims.map((d) => `- ${d.name}: ${d.score}/100`).join('\n'), structured };
  }
  if (name === 'render_rice_matrix') {
    const ranked = (args.items || [])
      .map((x) => ({ ...x, score: +((x.reach * x.impact * x.confidence) / Math.max(x.effort, 0.1)).toFixed(1) }))
      .sort((a, b) => b.score - a.score);
    return { text: ranked.map((x, i) => `${i + 1}. ${x.name} — RICE ${x.score}`).join('\n'), structured: { items: ranked } };
  }
  if (name === 'render_roadmap') {
    const structured = { title: args.title || 'Roadmap', quarters: args.quarters, lanes: args.lanes };
    const text = structured.lanes.map((l) => `${l.name}: ` + (l.items || []).map((i) => `${i.title} (${i.quarter}${i.status ? ', ' + i.status : ''})`).join('; ')).join('\n');
    return { text, structured };
  }
  return null;
}
