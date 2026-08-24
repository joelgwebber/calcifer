---
id: calcifer-52d2
title: NYC apartment listing early-alert skill
type: feature
priority: 2
created: '2026-06-23T21:15:05Z'
updated: '2026-08-15T04:46:16Z'
---

Build a NanoClaw skill that monitors multiple NYC rental listing sources and delivers real-time alerts for new listings before they get buried. Covers pre-RLS sources (Compass Coming Soon, direct landlord sites), no-fee management companies, Craigslist, and StreetEasy as full-market backstop. Configurable filters: neighborhoods, price, beds, amenities.

---

**2026-06-24 — promotion + cleanup (calcifer-52d2.11):** The working monitor existed only
in the gitignored agent workspace; promoted it into a version-controlled, generalized
skill at `container/skills/nyc-apt/` (de-hardcoded paths, config-driven sources, deps
manifest, rewritten SKILL.md). Live workspace copy + 12-min schedule left running. Lesson
fed back into the `self-customize` skill. Source-coverage children .3–.8 stay hairy and
match reality (Craigslist IP-blocked; Compass/Corcoran/Elliman SPA/blocked; TransparentCity
empty for 3BR+/$15k). Next real work here is broadening source coverage, not scaffolding.
