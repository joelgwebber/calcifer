---
name: nyc-apt
description: NYC apartment listing early-alert system. Polls StreetEasy plus owner-direct management-company sites on a schedule and alerts when new listings match configurable criteria (neighborhoods, price, beds). Each alert carries provenance (broker vs. owner-direct, no-fee flag, concessions). Use when the user wants to monitor the NYC rental market for fresh listings.
allowed-tools: Bash, Read, Write, Edit
---

# NYC Apartment Early-Alert

Monitors multiple listing sources and alerts (via WhatsApp or whatever channel the
agent group is wired to) when new listings match the criteria. The monitor runs as a
`schedule_task` pre-script: its last stdout line is `{ "wakeAgent": bool, "data": {...} }`,
so the agent is only woken when there are new listings.

## Layout (code vs. data)

This skill is mounted **read-only** at `/app/skills/nyc-apt/`. The code (`check.mjs`,
`db.mjs`) lives there and is version-controlled. All **writable** runtime state and the
native `better-sqlite3` binding live in a per-install **data dir**, resolved from
`$NYC_APT_DIR` (default `/workspace/agent/nyc-apt`):

| Path | What |
|------|------|
| `$NYC_APT_DIR/config.json` | User criteria + per-source settings |
| `$NYC_APT_DIR/state.json` | Seen-listing IDs (dedup) |
| `$NYC_APT_DIR/listings.db` | SQLite history of every listing + sightings |
| `$NYC_APT_DIR/node_modules/` | `better-sqlite3` + `streeteasy-api` |

## Setup (one time)

```bash
DIR="${NYC_APT_DIR:-/workspace/agent/nyc-apt}"
mkdir -p "$DIR"
cp /app/skills/nyc-apt/package.json "$DIR/package.json"
cp /app/skills/nyc-apt/config.example.json "$DIR/config.json"   # then edit criteria
echo '{"seen":{}}' > "$DIR/state.json"
( cd "$DIR" && npm install )                                    # builds better-sqlite3

# Smoke test
NYC_APT_DIR="$DIR" node /app/skills/nyc-apt/check.mjs streeteasy
```

Then register the recurring check with `schedule_task`, e.g. every 12 minutes:

- **cron:** `*/12 * * * *`
- **script:** `NYC_APT_DIR=/workspace/agent/nyc-apt node /app/skills/nyc-apt/check.mjs`
- **prompt:** instructions for how to format and where to send the alert (the script's
  `data.newListings` is injected into the prompt when `wakeAgent` is true).

> Note: the live scheduled-task ID is created by `schedule_task` at registration time —
> look it up with the scheduling tools rather than hardcoding it. Use the schedule's
> pause/delete verbs to pause or resume monitoring (or set `"active": false` in config).

## Config (`config.json`)

```json
{
  "neighborhoods": {
    "label": ["Upper West Side", "Hell's Kitchen", "Chelsea", "West Village", "Greenwich Village"],
    "streeteasy_areas": [135, 152, 115, 163, 157, 116],
    "craigslist_postal": ["10024", "10023", "10025", "10036", "10019"]
  },
  "price": { "min": null, "max": 15000 },
  "beds": { "min": 3, "max": null },
  "no_fee_only": false,
  "active": true,
  "sources": {
    "streeteasy": { "enabled": true },
    "craigslist": { "enabled": true },
    "stonehenge": { "enabled": true, "neighborhoods": ["upper west side", "chelsea"] },
    "glenwood":   { "enabled": true, "neighborhoods": ["Upper West Side"] }
  }
}
```

- `neighborhoods.streeteasy_areas` — StreetEasy numeric area IDs (the script's full-market
  source). Defaults to the UWS/HK/Chelsea/West Village/Greenwich Village set. Find IDs in
  the `streeteasy-api` package constants.
- `sources.<name>.enabled` — toggle a source off without removing config.
- `sources.<name>.neighborhoods` — per-source neighborhood filter (Stonehenge/Glenwood).
- `active: false` — pause all monitoring.

See `config.example.json` for a complete starter.

## Commands

```bash
DIR=/workspace/agent/nyc-apt

# Check all enabled sources now
NYC_APT_DIR="$DIR" node /app/skills/nyc-apt/check.mjs

# Check a single source (fast)
NYC_APT_DIR="$DIR" node /app/skills/nyc-apt/check.mjs streeteasy

# Re-alert on everything currently live (reset dedup state)
echo '{"seen":{}}' > "$DIR/state.json"
```

## Sources and status

| Source | Status | Notes |
|--------|--------|-------|
| StreetEasy | Working | Full-market backstop via `streeteasy-api`; includes broker + owner-direct + concessions. May need a residential proxy if PerimeterX blocks the server IP. |
| Stonehenge NYC | Working | HTML parse of Webflow/Finsweet page; owner-direct, no-fee. |
| Glenwood NYC | Working | HTML parse of search-result page; owner-direct, no-fee. |
| Craigslist RSS | Blocked | Server IP currently blocked by Craigslist; enable + retry from an unblocked egress. |
| Corcoran / Elliman / Compass | Not implemented | CloudFront / SPA / blocked API; their public listings surface on StreetEasy as `PARTNER`. (yaks calcifer-52d2.3, .7) |
| TransparentCity / direct mgmt sites | Not implemented | Aggregator had no 3BR+/$15k matches; broader mgmt-site coverage tracked in calcifer-52d2.6. |

## Adding a source

Each source is an `async (config) => listing[]` function registered in the `SOURCES` map
in `check.mjs`. Return objects with at least `{ id, source, title, url, price, beds }` plus
any provenance fields (`broker`, `sourceType`, `noFee`, `monthsFree`, `address`). `id` must
be stable across runs (it's the dedup key). Stonehenge/Glenwood are worked examples of
config-driven owner-direct adapters.

## Listing data fields

- `broker` — firm name (e.g. "Bond New York", "Stonehenge NYC", "Owner")
- `sourceType` — `OWNER` = owner-direct, no broker; `PARTNER` = broker-listed
- `noFee` — advertised as no broker fee
- `monthsFree` / `netEffectivePrice` — concessions; 1+ free months = softer demand signal
- `postedAt` — `priceChangedAt` from StreetEasy; approximates listing freshness
- `availableAt` — move-in date

## Key insight: provenance matters

- **`sourceType: OWNER`** — owner listed directly, no broker in the chain. Contact directly.
- **`sourceType: PARTNER` + management company name** — the building's own staff listed it.
- **`monthsFree > 0`** — unit has been sitting; landlord offering concessions. Negotiable.
- **Post-FARE Act (June 2025)** — landlords pay broker fees, so you can contact any listing
  agent directly without signing exclusivity.
