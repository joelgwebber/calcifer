#!/usr/bin/env node
/**
 * NYC Apartment Early-Alert Monitor
 * Polls multiple listing sources and emits new matches as a schedule_task
 * pre-script: the last stdout line is `{ wakeAgent, data }` (see SKILL.md).
 *
 * Code is version-controlled and runs read-only from the skill mount
 * (/app/skills/nyc-apt). All writable state and native deps live in the
 * per-install data dir, resolved from $NYC_APT_DIR (default
 * /workspace/agent/nyc-apt). See SKILL.md "Setup" for one-time install.
 *
 * Usage:
 *   node /app/skills/nyc-apt/check.mjs              # all enabled sources
 *   node /app/skills/nyc-apt/check.mjs streeteasy   # one source only
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { upsertListing, markStale } from './db.mjs';

const require = createRequire(import.meta.url);

const DATA_DIR = process.env.NYC_APT_DIR ?? '/workspace/agent/nyc-apt';
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const STATE_PATH = path.join(DATA_DIR, 'state.json');

function loadJSON(p, fallback) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state));
}

/** True unless config.sources.<name>.enabled is explicitly false. */
function sourceEnabled(config, name) {
  return config.sources?.[name]?.enabled !== false;
}

// ---------- Craigslist RSS --------------------------------------------------

function parseRSSItems(xml) {
  const items = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];
  for (const block of blocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() : null;
    };
    // <link> in RSS 2.0 is bare text between tags
    const linkMatch = block.match(/<link>(https?[^<]+)<\/link>/i);
    const url = linkMatch ? linkMatch[1].trim() : null;
    if (!url) continue;

    const title = get('title') ?? '';
    const pubDate = get('pubDate') ?? get('dc:date') ?? null;
    const priceMatch = title.match(/\$[\d,]+/) ?? (get('description') ?? '').match(/\$[\d,]+/);
    const price = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, ''), 10) : null;
    const bedsMatch = title.match(/(\d+)\s*(?:br|bed(?:room)?s?|bdrm)/i);
    const beds = bedsMatch ? parseInt(bedsMatch[1], 10) : null;

    items.push({ id: url, source: 'craigslist', title, url, price, beds, postedAt: pubDate, preMarket: false });
  }
  return items;
}

async function checkCraigslist(config) {
  const postalCodes = config.neighborhoods?.craigslist_postal
    ?? ['10024', '10023', '10036', '10019', '10011', '10014', '10012'];

  const params = new URLSearchParams();
  if (config.price?.min) params.set('min_price', config.price.min);
  if (config.price?.max) params.set('max_price', config.price.max);
  if (config.beds?.min)  params.set('min_bedrooms', config.beds.min);
  if (config.beds?.max)  params.set('max_bedrooms', config.beds.max);
  params.set('format', 'rss');

  const seen = new Set();
  const all = [];
  for (const postal of postalCodes) {
    const url = `https://newyork.craigslist.org/search/mnh/apa?${params}&postal=${postal}&search_distance=0.5`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; rss-reader/1.0)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const items = parseRSSItems(await res.text());
      for (const item of items) {
        if (!seen.has(item.id)) { seen.add(item.id); all.push(item); }
      }
    } catch { /* timeout or network, skip postal */ }
  }
  return all;
}

// ---------- Stonehenge (example owner-direct source adapter) ----------------

const STONEHENGE_DEFAULT_NEIGHBORHOODS = [
  'upper west side', 'chelsea', 'west village', 'greenwich village',
  'midtown west', // HK-adjacent
];

async function checkStonehenge(config) {
  const allowed = new Set(
    (config.sources?.stonehenge?.neighborhoods ?? STONEHENGE_DEFAULT_NEIGHBORHOODS)
      .map((n) => n.toLowerCase()),
  );
  try {
    const res = await fetch('https://www.stonehengenyc.com/apartments', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; apt-monitor/1.0)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Finsweet CMS Filter: all listing items are in the DOM as apt-card-collection-item
    const positions = [];
    const itemRe = /role="listitem" class="apt-card-collection-item[^"]*"/g;
    let m;
    while ((m = itemRe.exec(html)) !== null) positions.push(m.index);

    const listings = [];
    const seenIds = new Set();
    for (let i = 0; i < positions.length; i++) {
      const block = html.slice(positions[i], positions[i + 1] ?? positions[i] + 5000);

      const field = (name) => {
        const re = new RegExp('fs-cmsfilter-field="' + name + '"[^>]*>([^<]+)<', 'i');
        const fm = block.match(re);
        return fm ? fm[1].trim() : null;
      };

      const neighborhood = field('Neighborhood');
      if (!neighborhood || !allowed.has(neighborhood.toLowerCase())) continue;

      const bedroom = field('Bedroom');
      const bedsNum = bedroom
        ? (/studio/i.test(bedroom) ? 0 : parseInt(bedroom) || null)
        : null;
      if (config.beds?.min && bedsNum !== null && bedsNum < config.beds.min) continue;

      const priceRaw = field('price');  // lowercase = numeric version
      const price = priceRaw ? parseInt(priceRaw) : null;
      if (config.price?.max && price !== null && price > config.price.max) continue;

      const bathroom = field('Bathroom');
      const baths = bathroom ? parseFloat(bathroom) : null;
      const furnished = field('Furnished') === 'true';

      const addrM = block.match(/class="text-color-secondary text-size-small cards-text">([^<]+)</);
      const address = addrM ? addrM[1].trim() : null;

      const urlM = block.match(/href="(\/apartments\/[^"]+)"/);
      const url = urlM ? 'https://www.stonehengenyc.com' + urlM[1] : null;
      if (!url) continue;
      const listingId = `stonehenge-${urlM[1].replace(/[^a-z0-9]/g, '-')}`;
      if (seenIds.has(listingId)) continue;
      seenIds.add(listingId);

      const titleM = block.match(/title="([^"]+)"/);
      const title = titleM ? titleM[1] : null;

      listings.push({
        id: listingId,
        source: 'stonehenge',
        title: title ?? (address ?? 'Stonehenge'),
        url,
        address: address ? `${address}${title ? ` (${title})` : ''}` : null,
        neighborhood,
        price,
        beds: bedsNum,
        baths,
        noFee: true,   // Stonehenge is owner-direct, no broker fee
        sourceType: 'OWNER',
        broker: 'Stonehenge NYC',
        buildingType: 'MULTI_FAMILY',
        preMarket: false,
        notes: furnished ? 'Furnished' : null,
      });
    }
    return listings;
  } catch {
    return [];
  }
}

// ---------- Glenwood (example owner-direct source adapter) ------------------

const GLENWOOD_DEFAULT_NEIGHBORHOODS = ['Upper West Side', 'Midtown West', 'Downtown'];

async function checkGlenwood(config) {
  const neighborhoods = config.sources?.glenwood?.neighborhoods ?? GLENWOOD_DEFAULT_NEIGHBORHOODS;
  const results = [];
  const seen = new Set();

  for (const nhood of neighborhoods) {
    try {
      const params = new URLSearchParams({ bedroom: '-1', nhood, price: '' });
      const res = await fetch('https://www.glenwoodnyc.com/search-result/?' + params, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; apt-monitor/1.0)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const sections = html.split('<div class="col-md-4 col-sm-6"');
      for (let i = 1; i < sections.length; i++) {
        const block = sections[i];

        const lidM = block.match(/id="(\d+)"/);
        const lid = lidM ? lidM[1] : null;
        if (!lid || seen.has(lid)) continue;
        seen.add(lid);

        const buildM = block.match(/<h3>\s*<a[^>]+>([^<]+)<\/a>/);
        const building = buildM ? buildM[1].trim() : null;

        const priceM = block.match(/monthy-rent[^>]*><span[^>]*>([^<]+)<\/span>/);
        const priceRaw = priceM ? priceM[1].replace(/[$,\s]/g, '') : null;
        const price = priceRaw ? parseInt(priceRaw) : null;
        if (config.price?.max && price !== null && price > config.price.max) continue;

        // Beds: find first numeric span within 2000 chars of "Bedrooms"
        const bedsChunk = block.slice(block.indexOf('Bedrooms'), block.indexOf('Bedrooms') + 2000);
        const bedsSpans = [...bedsChunk.matchAll(/<span>(\d+)<\/span>/g)];
        const beds = bedsSpans.length > 0 ? parseInt(bedsSpans[0][1]) : null;
        if (config.beds?.min && beds !== null && beds < config.beds.min) continue;

        const bathsChunk = block.slice(block.indexOf('Bathrooms'), block.indexOf('Bathrooms') + 2000);
        const bathsSpans = [...bathsChunk.matchAll(/<span>(\d+(?:\.\d+)?)<\/span>/g)];
        const baths = bathsSpans.length > 0 ? parseFloat(bathsSpans[0][1]) : null;

        const nhoodM = block.match(/<span>([^<]+)<\/span>/);
        const neighborhood = nhoodM ? nhoodM[1].trim() : nhood;

        results.push({
          id: `glenwood-${lid}`,
          source: 'glenwood',
          title: building ? `${building} #${lid}` : `Glenwood #${lid}`,
          url: `https://www.glenwoodnyc.com/listing-detail/?lid=${lid}`,
          address: building ?? null,
          neighborhood,
          price,
          beds,
          baths,
          noFee: true,
          sourceType: 'OWNER',
          broker: 'Glenwood NYC',
          buildingType: 'MULTI_FAMILY',
          preMarket: false,
        });
      }
    } catch { /* non-fatal, skip neighborhood */ }
  }
  return results;
}

// ---------- StreetEasy -------------------------------------------------------

// Default StreetEasy area IDs (full-market backstop). Override per-install via
// config.neighborhoods.streeteasy_areas. Reference (from streeteasy-api
// constants): ALL_UPPER_WEST_SIDE=135, HELLS_KITCHEN=152, CHELSEA=115,
// WEST_CHELSEA=163, WEST_VILLAGE=157, GREENWICH_VILLAGE=116.
const STREETEASY_DEFAULT_AREAS = [135, 152, 115, 163, 157, 116];

async function checkStreetEasy(config) {
  let pkg;
  try {
    pkg = require(path.join(DATA_DIR, 'node_modules', 'streeteasy-api', 'dist', 'index.js'));
  } catch {
    return []; // package not installed in data dir, skip silently
  }

  const { StreetEasyClient } = pkg;
  const client = new StreetEasyClient();
  const areas = config.neighborhoods?.streeteasy_areas ?? STREETEASY_DEFAULT_AREAS;

  try {
    const res = await client.searchRentals({
      sorting: { attribute: 'LISTED_AT', direction: 'DESCENDING' },
      filters: {
        areas,
        rentalStatus: 'ACTIVE',
        price: {
          lowerBound: config.price?.min ?? null,
          upperBound: config.price?.max ?? null,
        },
        bedrooms: {
          lowerBound: config.beds?.min ?? null,
          upperBound: config.beds?.max ?? null,
        },
      },
    });

    const edges = res?.searchRentals?.edges ?? [];
    return edges.map(({ node: l }) => ({
      id: `se-${l.id}`,
      source: 'streeteasy',
      title: `${l.bedroomCount ?? '?'}BR at ${l.street ?? 'NYC'}${l.unit ? ` #${l.unit}` : ''}`.trim(),
      url: l.urlPath ? `https://streeteasy.com${l.urlPath}` : null,
      price: l.price ?? null,
      beds: l.bedroomCount ?? null,
      baths: (l.fullBathroomCount ?? 0) + (l.halfBathroomCount ? 0.5 : 0) || null,
      address: `${l.street ?? ''}${l.unit ? ` #${l.unit}` : ''}, ${l.areaName ?? 'NYC'}`,
      neighborhood: l.areaName ?? null,
      noFee: l.noFee ?? false,
      availableAt: l.availableAt ?? null,
      postedAt: l.priceChangedAt ?? null,
      // Provenance: who listed it and how fresh it looks
      broker: l.sourceGroupLabel ?? null,
      sourceType: l.sourceType ?? null,   // 'PARTNER' = broker-listed; null/other = direct
      monthsFree: l.monthsFree ?? 0,
      netEffectivePrice: l.netEffectivePrice || null,
      buildingType: l.buildingType ?? null,
      preMarket: false,
    }));
  } catch {
    return [];
  }
}

// ---------- Source registry --------------------------------------------------

const SOURCES = {
  craigslist: checkCraigslist,
  streeteasy: checkStreetEasy,
  stonehenge: checkStonehenge,
  glenwood: checkGlenwood,
};

// ---------- State management ------------------------------------------------

function filterNew(listings, state, source) {
  const seen = new Set(state.seen?.[source] ?? []);
  return listings.filter((l) => !seen.has(l.id));
}

function updateState(state, listings, source) {
  if (!state.seen) state.seen = {};
  const existing = state.seen[source] ?? [];
  const allIds = [...new Set([...existing, ...listings.map((l) => l.id)])];
  // Keep only last 2000 IDs per source to prevent unbounded growth
  state.seen[source] = allIds.slice(-2000);
}

// ---------- Main ------------------------------------------------------------

const args = process.argv.slice(2);
const sourcesOnly = args[0]; // a source name, or undefined (all enabled)

const config = loadJSON(CONFIG_PATH, {});
if (config.active === false) {
  console.log(JSON.stringify({ wakeAgent: false, data: { reason: 'monitoring paused' } }));
  process.exit(0);
}

const state = loadJSON(STATE_PATH, { seen: {} });

let all = [];
for (const [name, fn] of Object.entries(SOURCES)) {
  if (sourcesOnly && sourcesOnly !== name) continue;
  if (!sourcesOnly && !sourceEnabled(config, name)) continue;
  all = all.concat(await fn(config));
}

const newListings = [];
for (const listing of all) {
  if (filterNew([listing], state, listing.source).length > 0) {
    newListings.push(listing);
  }
}

// Write all listings into the database (new + seen)
for (const listing of all) {
  try { upsertListing(listing); } catch { /* db write failure is non-fatal */ }
}

// Mark listings we didn't see this run as potentially gone (after 60 min)
for (const [src, srcListings] of Object.entries(
  all.reduce((acc, l) => { (acc[l.source] ??= []); acc[l.source].push(l.id); return acc; }, {}),
)) {
  try { markStale(src, srcListings); } catch { /* non-fatal */ }
}

// Update state with everything we saw (new + old) so we don't re-alert
const bySource = {};
for (const l of all) { (bySource[l.source] ??= []).push(l); }
for (const [src, listings] of Object.entries(bySource)) {
  updateState(state, listings, src);
}
saveState(state);

if (newListings.length === 0) {
  console.log(JSON.stringify({ wakeAgent: false, data: {} }));
} else {
  console.log(JSON.stringify({
    wakeAgent: true,
    data: {
      newListings,
      checkedAt: new Date().toISOString(),
    },
  }));
}
