const E = process.env;
const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,GET,OPTIONS', 'content-type': 'application/json' };
const hits = new Map();
let day = 0, n = 0, sys = '', at = 0;
const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
export default {
  async fetch(r) {
    if (r.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
    if (r.method !== 'POST') return out({ ok: 1, hy: 'ready' });
    const t = Date.now(), ip = (r.headers.get('x-forwarded-for') || '').split(',')[0].trim(), d = Math.floor(t / 864e5);
    if (d !== day) { day = d; n = 0; hits.clear(); }
    const h = (hits.get(ip) || []).filter(x => t - x < 6e4);
    if (h.length >= (ip ? 10 : 90) || ++n > (+E.DAILY || 2000)) return out({ error: 'busy' }, 429);
    h.push(t); hits.set(ip, h);
    try {
      if (E.PROMPT_URL && t - at > 6e5) { const p = await fetch(E.PROMPT_URL); if (p.ok) { sys = await p.text(); at = t; } }
      const b = await r.json();
      const m = (Array.isArray(b.messages) ? b.messages : []).slice(-8).map(x => ({ role: x.role === 'assistant' ? 'assistant' : 'user', content: String(x.content || '').slice(0, 600) }));
      if (!m.length || m[m.length - 1].role !== 'user') return out({ error: 'bad' }, 400);
      const mode = /^(interview|mystery) [a-z0-9]{1,20}$/.test(b.mode) ? '\n\nACTIVE MODE: ' + b.mode : '';
      const g = await fetch(E.NEON_AI_GATEWAY_BASE_URL + '/v1/chat/completions', {
        method: 'POST', headers: { authorization: 'Bearer ' + E.NEON_AI_GATEWAY_TOKEN, 'content-type': 'application/json' },
        body: JSON.stringify({ model: E.MODEL || 'claude-haiku-5-5', max_tokens: 500, messages: [{ role: 'system', content: (sys || E.SYS || 'You are Hy, a friendly hydrogen atom detective who explains NASA hardware left on the Moon and Mars to kids, in 2 to 4 short sentences.') + mode }, ...m] })
      });
      const j = await g.json();
      let c = j.choices?.[0]?.message?.content;
      if (Array.isArray(c)) c = c.filter(x => x?.type === 'text').map(x => x.text).join('');
      return c ? out({ text: c }) : out({ error: 'upstream', detail: String(j.error?.message || j.message || g.status).slice(0, 300) }, 502);
    } catch (e) { return out({ error: 'server', detail: String(e).slice(0, 300) }, 500); }
  }
};
