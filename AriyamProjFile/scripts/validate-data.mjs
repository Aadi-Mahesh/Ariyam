// Checks map_locs.json. Run: npm run validate   (add --links to also request every URL)
import { readFileSync } from 'node:fs';

const TYPES = ['Robotics', 'Space', 'Science Centre', 'Deep Tech', 'Biotech', 'Marine Science'];
const ACCESS = ['open', 'events', 'appointment', 'register'];
const data = JSON.parse(readFileSync(new URL('../map_locs.json', import.meta.url), 'utf8'));
const errors = [], seen = new Set(), urls = [];
const isHttps = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

data.forEach((l, i) => {
  const at = (m) => errors.push(`${l.id || '#' + i}: ${m}`);
  if (!l.id) at('missing id'); else if (seen.has(l.id)) at('duplicate id'); else seen.add(l.id);
  if (!l.name) at('missing name');
  if (!TYPES.includes(l.type)) at(`bad type "${l.type}"`);
  if (!ACCESS.includes(l.access)) at(`bad access "${l.access}"`);
  const [lat, lng] = l.coords || [];
  if (!(lat >= 6 && lat <= 15 && lng >= 72 && lng <= 81)) at(`coords outside South India: ${l.coords}`);
  if (!l.shortDesc) at('empty shortDesc');
  for (const k of ['website', 'img', 'imgSource']) {
    if (l[k]) { if (!isHttps(l[k])) at(`${k} is not an https URL`); else urls.push([l.id, k, l[k]]); }
  }
  if (l.img && !l.imgSource) at('img without imgSource (credit)');
  if (/[—–]/.test(JSON.stringify(l))) at('contains a long dash');
});

if (process.argv.includes('--links')) {
  for (const [id, k, u] of urls) {
    try {
      const r = await fetch(u, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'ariyam-validate' } });
      if (!r.ok) errors.push(`${id}: ${k} returned ${r.status} (${u})`);
      else if (k === 'img' && !(r.headers.get('content-type') || '').startsWith('image/')) errors.push(`${id}: img is not an image (${u})`);
    } catch (e) { errors.push(`${id}: ${k} failed (${e.message})`); }
  }
}
console.log(`${data.length} places checked`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('all good');
