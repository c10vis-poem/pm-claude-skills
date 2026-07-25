// Shared sessions for the Org Edition — the multiplayer layer. A session is one
// skill run (input + artifact) that a teammate can open by link, comment on, and
// approve — so "PM drafts the PRD, design and eng review it" happens here
// instead of in a copy-paste to Slack.
//
// Same trust model as the rest of the Org server: no accounts, names are
// self-reported, access control is your network's job. Storage is one JSON file
// per session (default org/sessions-data/, override --sessions-data) — no
// database, survives restarts, trivially backed up.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const STATUSES = ['draft', 'in-review', 'approved', 'changes-requested'];
const MAX_BODY = 512 * 1024; // one artifact + history, not a file share

export function makeSessions(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const file = (id) => join(dataDir, id + '.json');
  const okId = (id) => /^[a-f0-9-]{8,36}$/.test(id); // no path traversal
  const load = (id) => (okId(id) && existsSync(file(id)) ? JSON.parse(readFileSync(file(id), 'utf8')) : null);
  const save = (s) => { s.updated = new Date().toISOString(); writeFileSync(file(s.id), JSON.stringify(s, null, 2)); return s; };
  const str = (v, cap = 20000) => String(v ?? '').slice(0, cap);

  function create({ title, skill, input, artifact, author }) {
    const s = {
      id: randomUUID().slice(0, 8) + '-' + randomUUID().slice(0, 4),
      title: str(title, 200) || 'Untitled session',
      skill: str(skill, 100), author: str(author, 100) || 'anonymous',
      status: 'draft', input: str(input, 100000), artifact: str(artifact, 200000),
      comments: [], revisions: [], created: new Date().toISOString(),
    };
    return save(s);
  }

  function list() {
    return readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => {
      try {
        const { id, title, skill, status, author, updated, comments } = JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
        return { id, title, skill, status, author, updated, comments: (comments || []).length };
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  }

  // Returns true if it handled the request. json(res, obj, code) comes from the server.
  return function handle(req, res, url, json, body) {
    const p = url.pathname;
    if (!p.startsWith('/v1/sessions') && !p.startsWith('/session/')) return false;

    // Human-facing review page: /session/<id>
    if (p.startsWith('/session/') && req.method === 'GET') {
      const s = load(p.slice(9));
      if (!s) { res.writeHead(404); res.end('no such session'); return true; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE.replace('__DATA__', JSON.stringify(s).replace(/</g, '\\u003c')));
      return true;
    }
    if (req.method === 'GET' && p === '/v1/sessions') { json(res, { count: list().length, sessions: list() }); return true; }
    if (req.method === 'GET' && /^\/v1\/sessions\/[^/]+$/.test(p)) {
      const s = load(p.split('/')[3]);
      s ? json(res, s) : json(res, { error: 'not_found' }, 404);
      return true;
    }
    if (req.method !== 'POST') return false;

    let data;
    try { data = JSON.parse(body || '{}'); } catch { json(res, { error: 'bad_json' }, 400); return true; }
    if ((body || '').length > MAX_BODY) { json(res, { error: 'too_big' }, 413); return true; }

    if (p === '/v1/sessions') {
      const s = create(data);
      json(res, { id: s.id, url: '/session/' + s.id, session: s }, 201);
      return true;
    }
    const m = p.match(/^\/v1\/sessions\/([^/]+)\/(comments|status|artifact)$/);
    if (!m) return false;
    const s = load(m[1]);
    if (!s) { json(res, { error: 'not_found' }, 404); return true; }

    if (m[2] === 'comments') {
      const text = str(data.text, 5000).trim();
      if (!text) { json(res, { error: 'empty_comment' }, 400); return true; }
      s.comments.push({ author: str(data.author, 100) || 'anonymous', text, quote: str(data.quote, 500) || undefined, at: new Date().toISOString() });
      if (s.status === 'draft') s.status = 'in-review';
    } else if (m[2] === 'status') {
      if (!STATUSES.includes(data.status)) { json(res, { error: 'bad_status', allowed: STATUSES }, 400); return true; }
      s.status = data.status;
      s.comments.push({ author: str(data.by, 100) || 'anonymous', text: '→ ' + data.status, at: new Date().toISOString(), system: true });
    } else if (m[2] === 'artifact') {
      // Approval is of a specific text: superseding it reopens review.
      s.revisions.push({ artifact: s.artifact, at: s.updated, by: s.author });
      if (s.revisions.length > 20) s.revisions.shift();
      s.artifact = str(data.artifact, 200000);
      s.author = str(data.by, 100) || s.author;
      if (s.status === 'approved') s.status = 'in-review';
    }
    json(res, save(s));
    return true;
  };
}

// Minimal review page — no build step, no external requests, matches the
// zero-dependency rule of the Org server.
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Session review</title><style>
:root{--fg:#1a1a2e;--bg:#fff;--muted:#667;--line:#e3e3ec;--card:#f7f7fb}
@media(prefers-color-scheme:dark){:root{--fg:#e8e8f0;--bg:#16161f;--muted:#99a;--line:#2c2c3a;--card:#1e1e2a}}
*{box-sizing:border-box;margin:0}body{font:15px/1.5 system-ui,sans-serif;color:var(--fg);background:var(--bg);max-width:900px;margin:0 auto;padding:24px}
h1{font-size:20px}.muted{color:var(--muted);font-size:13px;margin:4px 0 16px}
.pill{padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;color:#fff;background:#8a5cf5}
pre{white-space:pre-wrap;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;font:13px/1.5 ui-monospace,monospace}
.c{border-left:3px solid var(--line);padding:6px 10px;margin:8px 0}.c b{font-size:13px}.c .muted{margin:0}
textarea,input{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit;margin:4px 0}
button{padding:8px 14px;border:0;border-radius:8px;background:#8a5cf5;color:#fff;font:inherit;cursor:pointer;margin:4px 6px 0 0}
button.alt{background:var(--card);color:var(--fg);border:1px solid var(--line)}
</style></head><body><div id="app"></div><script>
const S=__DATA__;const esc=(t)=>String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const api=(path,payload)=>fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(()=>location.reload());
document.getElementById('app').innerHTML=
 '<h1>'+esc(S.title)+' <span class="pill">'+esc(S.status)+'</span></h1>'+
 '<div class="muted">'+esc(S.skill||'no skill')+' · by '+esc(S.author)+' · updated '+esc((S.updated||'').slice(0,16).replace('T',' '))+'</div>'+
 '<pre>'+esc(S.artifact||'(no artifact yet)')+'</pre>'+
 '<h3 style="margin:18px 0 6px">Comments ('+S.comments.length+')</h3>'+
 S.comments.map(c=>'<div class="c"><b>'+esc(c.author)+'</b> <span class="muted">'+esc((c.at||'').slice(0,16).replace('T',' '))+'</span>'+(c.quote?'<div class="muted">&gt; '+esc(c.quote)+'</div>':'')+'<div>'+esc(c.text)+'</div></div>').join('')+
 '<input id="who" placeholder="your name"><textarea id="txt" rows="3" placeholder="comment"></textarea>'+
 '<button onclick="api(\\'/v1/sessions/'+S.id+'/comments\\',{author:who.value,text:txt.value})">Comment</button>'+
 '<button class="alt" onclick="api(\\'/v1/sessions/'+S.id+'/status\\',{by:who.value,status:\\'approved\\'})">Approve</button>'+
 '<button class="alt" onclick="api(\\'/v1/sessions/'+S.id+'/status\\',{by:who.value,status:\\'changes-requested\\'})">Request changes</button>';
</script></body></html>`;
