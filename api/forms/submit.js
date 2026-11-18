// Gemaakt door Vystara Studio bij het publiceren. Niet met de hand aanpassen.
const FORMS = {};
const hits = new Map();
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (typeof body._hp === 'string' && body._hp.trim()) return res.json({ ok: true });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0];
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  if (list.length >= 5) return res.status(429).json({ error: 'Te veel berichten. Probeer het later opnieuw.' });
  hits.set(ip, [...list, now]);
  const id = String(body._form || ''), form = FORMS[id] || FORMS[id.split('__').pop()];
  if (!form) return res.status(404).json({ error: 'Formulier niet gevonden' });
  const data = {};
  for (const f of form.fields) {
    const v = String(body['f_' + f.id] || '').trim().slice(0, f.kind === 'textarea' ? 5000 : 500);
    if (f.required && !v) return res.status(400).json({ error: 'Vul "' + f.label + '" in' });
    if (v && f.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return res.status(400).json({ error: 'Dat e-mailadres klopt niet' });
    data[f.label] = v;
  }
  const lines = Object.entries(data).map(([k, v]) => '**' + k + ':** ' + v).join('\n');
  const jobs = [];
  if (process.env.FORM_WEBHOOK_URL) jobs.push(fetch(process.env.FORM_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: ('📬 Nieuw bericht via **' + form.name + '**\n' + lines).slice(0, 1990), allowed_mentions: { parse: [] } }) }));
  if (process.env.STUDIO_URL) jobs.push(fetch(process.env.STUDIO_URL.replace(/\/$/, '') + '/api/forms/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  if (!jobs.length) return res.status(500).json({ error: 'Formulier is nog niet ingesteld (FORM_WEBHOOK_URL ontbreekt in Vercel).' });
  const results = await Promise.allSettled(jobs);
  if (results.every((r) => r.status === 'rejected')) return res.status(502).json({ error: 'Versturen mislukt, probeer het later opnieuw.' });
  return res.json({ ok: true });
};
