// Collects the GitHub traffic of this repository into traffic.json for stats.html.
// GitHub keeps only the last 14 days, so each run merges the new days into the history.
// Needs a token that can read repository traffic (GH_TOKEN). Usage: node traffic.mjs [repo]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REPO = process.argv[2] || process.env.GITHUB_REPOSITORY || 'whiang/Beagle';
const TOKEN = process.env.GH_TOKEN;
const FILE = new URL('traffic.json', import.meta.url);
if (!TOKEN) { console.log('GH_TOKEN not set; traffic.json unchanged'); process.exit(0); }

async function get(path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/traffic/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'beagle-traffic' },
  });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

const old = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
const [views, clones, referrers, paths] = await Promise.all(['views', 'clones', 'popular/referrers', 'popular/paths'].map(get));
// a day's numbers can still grow until the day is over, so the newest value wins
const merge = (hist = {}, days) => {
  const out = { ...hist };
  for (const d of days) out[d.timestamp.slice(0, 10)] = { count: d.count, uniques: d.uniques };
  return Object.fromEntries(Object.entries(out).sort());
};
const data = {
  repo: REPO,
  updated: new Date().toISOString(),
  views: merge(old.views, views.views),
  clones: merge(old.clones, clones.clones),
  last14: { views: { count: views.count, uniques: views.uniques }, clones: { count: clones.count, uniques: clones.uniques } },
  referrers,
  paths,
};
writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
console.log(`traffic.json: ${Object.keys(data.views).length} days, last 14 days ${views.count} views / ${clones.count} clones`);
