---
id: calcifer-f5e2
title: 'Etymology graph database: design and implementation'
type: feature
priority: 3
created: '2026-04-24T15:06:44Z'
updated: '2026-04-24T15:06:44Z'
---

Build an interactive, queryable etymology graph database pulling from multiple publicly available sources. Full research and design notes saved to family wiki at /documents/etymology-graph-research.md. Summary below.

SOURCES

Automated pipeline (weekly/quarterly):
- kaikki.org/Wiktextract: primary backbone, ~2.5M senses, 500+ languages, weekly JSONL dumps, parse etymology_templates field for structured relations. CC BY-SA 3.0.
- etymology-db (droher): ~2M terms, 3300+ languages, 4.2M relations, CSV/Parquet, best 31-type relation vocabulary. CC BY-SA 3.0.
- EtymDB 2.1 (clefourrier): ~1.8M lexemes, 2536 languages, clean 3-file CSV schema. CC BY-SA 4.0.

One-time manual enrichment:
- Starling (starlingdb.org): expert proto-form entries across 23 families (IE, Altaic, Semitic, Dravidian, Sino-Tibetan, Khoisan, etc.). Proprietary DBF format; use rhaver/Starling-cs to export. No explicit license.
- STEDT: 433K lexical items, 566 Sino-Tibetan languages. Best for Chinese/Tibetan deep history. No bulk download; legacy web interface only. CC BY 4.0.
- CLICS (clics.clld.org): 1.44M forms, 3420 language varieties. Colexification (semantic overlap), not etymology. Adds semantic graph layer. CLDF format. CC BY 4.0.

DATA MODEL

Node fields: uid (source:lang_code:form), lang_code (Glottolog preferred), lang_name, form (native script), romanization, reconstructed (bool), gloss_en, pos, etymology_text, source_db list, ingested_at.

Edge fields: from_uid, to_uid, reltype (canonical), original_reltype, position (for compounds), source_db, confidence, references.

Canonical relation types: inherited_from, borrowed_from, derived_from, compound_of, blend_of, calque_of, cognate_of, doublet_with, root, back-formation_from, abbreviation_of, named_after, phono-semantic_matching_of, colexifies_with (CLICS semantic layer).

QUERY OPERATIONS
1. Etymology chain: word to full ancestor chain to proto-root
2. Cognate discovery: words sharing a reconstructed ancestor across languages
3. Borrowing path tracing: e.g., Arabic to Persian to Turkic to Turkish
4. Language contact scoring: aggregate borrowed_from edges between language pairs
5. Semantic clustering (CLICS): concepts colexified across many languages
6. Morphological family tree: all descendants of a proto-root
7. Semantic drift detection: gloss comparison across ancestor/descendant nodes

UPDATE PIPELINE
- Weekly automated: kaikki.org JSONL download, parse etymology_templates, resolve lang codes to Glottolog, upsert by uid
- Quarterly semi-automated: regen etymology-db from Wiktionary XML dump, diff and ingest
- One-time manual: Starling via Starling-cs, STEDT via scraping, CLICS via pycldf

TECH STACK
- Graph DB: Neo4j (or DuckDB/Parquet for offline analysis)
- Language code authority: Glottolog
- Orchestration: Python pipeline scripts
- Dedup: NFC-normalized lowercase (form, lang_code)

GAPS
- Arabic internal Semitic etymology: Starling partially fills this gap
- Sino-Tibetan deep history: STEDT hard to access
- Bantu/sub-Saharan Africa: biggest gap; BLR3 exists but access unclear
- Amerindian, Papuan, most indigenous: sparse or absent everywhere
- No source captures borrowing dates, phonological change paths, or semantic change over time
