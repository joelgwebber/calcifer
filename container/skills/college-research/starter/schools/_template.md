---
# Structured header. Fields are grouped by criterion; every non-derived cell carries
# the full metadata contract (see schema.yml meta.field_metadata). Derived fields
# (grad_gap_4_to_6, orgs_per_1000_undergrads, ...) are NOT stored — `colleges.mjs
# derive` computes them from the inputs below. Run `colleges.mjs missing <slug>` to
# see every field still unfilled. Leave a field OUT entirely rather than guessing a
# value; an `estimated` confidence REQUIRES a notes line stating the assumptions.
schema_version: "0.1"
school: Example University
slug: example
location: City, ST
type: large-urban-research      # free label; groups peers for the size-band caveat
last_reviewed: "2026-01-01"

fields:
  engagement:
    undergraduates:
      value: 20000
      source_url: https://example.edu/cds
      source_type: cds
      as_of: "Fall 2024"        # reporting period of the DATA, not the CDS edition year
      retrieved: "2026-01-01"
      confidence: reported
      notes: ""
    sections_under_20_pct:
      value: 55
      source_url: https://example.edu/cds
      source_type: cds
      as_of: "Fall 2024"
      retrieved: "2026-01-01"
      confidence: reported
      notes: ""
    sections_50plus_pct:        # required companion of the above (§4)
      value: 12
      source_url: https://example.edu/cds
      source_type: cds
      as_of: "Fall 2024"
      retrieved: "2026-01-01"
      confidence: reported
      notes: ""
    presence_continuity_pct:
      value: 90
      source_url: https://example.edu/about
      source_type: estimate
      as_of: "AY 2024-25"
      retrieved: "2026-01-01"
      confidence: estimated
      notes: "100 - (study_abroad 45% x 1 term / 8) ≈ 94; rounded down for satellite rotation. Store the arithmetic, not just the number."
---

# Example University

<!-- Exposition (Tier C): free prose, structured by the four sub-constructs plus
     governance friction. This zone carries findings the schema cannot represent and
     is a first-class citizen — do not push toward eliminating it. Cite references by
     id, e.g. [paper-2025-10-14]. -->

## Voluntary intellectual life

## Organizational density

## Faculty access

## Civic embeddedness

## Governance friction

## Notable artifacts
- <!-- 3-5 specific, dated, named examples: a student-founded org + founding year, a
       recurring event, a student-taught course. -->

## References

<!-- References live here in the body (not frontmatter): they read naturally as prose
     and keep the structured header light. Cite them inline above by id, e.g.
     [paper-2025-10-14]. Tier 1-3 per the evidence model; for student media, note the
     provenance (news / op-ed / letter). -->

- **paper-2025-10-14** — [Opinion: ...](https://example.edu/paper/opinion/...) · The Example Daily, 2025-10-14 · Tier 1 · op-ed
