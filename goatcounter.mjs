// Collects the web app visitors by country and region from GoatCounter (whiang.goatcounter.com)
// into goatcounter.json for stats.html. GoatCounter keeps the whole history, so each run
// asks for everything since counting started (web app 1.1.1).
// Needs an API token with "Read statistics" (GC_TOKEN). Usage: node goatcounter.mjs
import { writeFileSync } from 'node:fs';

const SITE = 'https://whiang.goatcounter.com';
const START = '2026-10-31';
const TOKEN = process.env.GC_TOKEN;
const FILE = new URL('goatcounter.json', import.meta.url);
if (!TOKEN) { console.log('GC_TOKEN not set; goatcounter.json unchanged'); process.exit(0); }

async function get(path) {
  const r = await fetch(`${SITE}/api/v0/${path}`, { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } });
  // GoatCounter answers 404 while there is nothing to count yet
  if (r.status === 404) { console.log(`${path}: 404 (no data)`); return {}; }
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

// the API wants date-times rounded to the hour
const hour = new Date(Math.ceil(Date.now() / 3600e3) * 3600e3).toISOString().slice(0, 19) + 'Z';
const range = `start=${START}T00:00:00Z&end=${hour}`;
// visitors per entry (older GoatCounter versions call it count_unique)
const rows = list => list.map(s => ({ id: s.id, name: s.name || s.id || '(unknown)', count: s.count ?? s.count_unique ?? 0 }));
const total = await get(`stats/total?${range}`);
const countries = rows((await get(`stats/locations?${range}&limit=100`)).stats || []);
for (const c of countries) {
  if (!c.id) { c.regions = []; continue; }
  c.regions = rows((await get(`stats/locations/${encodeURIComponent(c.id)}?${range}&limit=100`)).stats || [])
    .filter(r => r.id && r.id !== c.id);
}
const data = { site: SITE, updated: new Date().toISOString(), start: START, total: total.total ?? total.total_unique ?? 0, countries };
writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
console.log(`goatcounter.json: ${data.total} visitors, ${countries.length} countries`);
