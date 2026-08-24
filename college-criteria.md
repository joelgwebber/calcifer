# Student Engagement Research: Structural Findings and System Specification

**Status:** Draft v0.1 — calibrated on two schools (Northeastern University, Boston University)
**Purpose:** Define the evidence model, field schema, and record structure for a curated college research system
**Scope note:** This document covers the *student engagement* criterion only. It is written to be extended — see §8.

---

## 1. What this measures, and why it needs decomposing

The target construct is **authentic student engagement**: students who are deeply involved with ideas, organizations, faculty, and community by their own initiative — as distinct from institutions that *purchase* the appearance of engagement through high-profile programming.

Engagement is not one variable. Treating it as one produces a single score that averages away the actual finding. It decomposes into at least four sub-constructs, which correlate imperfectly and whose evidence lives in different places:

| Sub-construct | What it means | Where evidence lives |
|---|---|---|
| **Voluntary intellectual life** | Students attend talks, reading groups, and events nobody required | Student paper opinion pages; recorded lecture Q&A; events calendar |
| **Organizational density** | Students found things, and those things survive leadership turnover | Org directory backend; founding dates; club social media recency |
| **Faculty access** | Out-of-class contact is normal rather than exceptional | Class-size distribution; subsection ratio; undergraduate research programs |
| **Civic embeddedness** | Sustained local involvement, not one-day service | Local press; service program structure; co-op/internship civic placements |

**Calibration finding:** a school can score at the top of one and the bottom of another. Both test schools were strong on organizational density and weak-to-ambiguous on voluntary intellectual life. Any system that collapses these into one number will report both schools as "middling" and will have destroyed the actual result.

---

## 2. The evidence model

### 2.1 Source tiers, ranked by resistance to manipulation

Rank sources by how expensive they are for an institution to fake. This ordering has held across both calibration runs.

**Tier 1 — Student-produced, timestamped, not institutionally curated.** Highest value, lowest volume.
- Independent student newspaper archives, especially opinion and letters sections
- Recorded lecture Q&A on department channels (watch the last 15 minutes)
- Student org social accounts — check *posting recency*, not existence
- Student-run journals, radio, podcasts, undergraduate research reviews

**Tier 2 — Institutional but not promotional.** Highest volume, reliably comparable.
- Common Data Set (the workhorse; see §3)
- IPEDS
- Accreditation self-studies (SACSCOC, NECHE, MSCHE) — public, candid, written for peer reviewers rather than parents
- Campus events calendar for a randomly chosen mid-semester weekday
- Student government budget documents and funding manuals
- Org directory *backend* listing pages, which often disagree with marketing copy

**Tier 3 — Directional only.**
- Reddit, Niche, College Confidential — read for texture, never for verdicts
- Fulbright top-producer lists, Watson counts, NSF baccalaureate-origins data

### 2.2 Sampling discipline

- **Never sample orientation, admitted-students season, or homecoming.** Use October or February.
- **Read six consecutive weeks** of the student paper, not a keyword search. Keyword search finds what you expect; consecutive reading finds what's actually there.
- **Pick a random Tuesday in week 9** for the events calendar and record who hosted each event: academic department, student org, or administration.

### 2.3 Falsification tests

Run these before accepting any positive finding.

- **Marketing-vs-backend test.** Compare the headline org count to the directory's own filter counts. In calibration this exposed a ~25% overstatement, with graduate orgs, club sports, Greek chapters, and satellite campuses folded into an undergraduate-sounding figure.
- **Long-tail test.** Does the 400-person headliner have a 20-person analog? Culture lives in the small events.
- **Turnover test.** Has a student-run organization survived 10+ years across four complete generations of leadership? Longevity through turnover is culture; a three-year-old initiative is a grant.
- **Incentive test.** Is attendance driven by free food, class credit, or a convocation requirement?
- **Non-admissions search.** Search the domain excluding `/admissions` and `/news`. If the engagement only appears in marketing copy, that is the answer.
- **Weird-club test.** Scroll the directory's long tail. Generic clubs exist everywhere; a mycology society or a standing reading group means students are building things unprompted.

---

## 3. Field schema

Three tiers by confidence and effort. Every field carries a source and an as-of date (see §5).

### 3.1 Tier A — Hard, published, directly comparable

Pull from the Common Data Set unless noted. Roughly 20 minutes per school once you know the section numbers.

| Field | Type | Source | Definition / derivation |
|---|---|---|---|
| `housing_upperclass_pct` | pct | CDS F1 | % of all degree-seeking undergraduates in college-owned/operated/affiliated housing. Record the first-year figure alongside it; the gap is the signal. |
| `offcampus_pct` | pct | CDS F1 | % living off-campus or commuting. Complement of above. |
| `grad_rate_4yr` | pct | CDS B4–B11 | Line D ÷ line C for the most recent completed cohort. **Do not substitute the 6-year rate.** |
| `grad_rate_6yr` | pct | CDS B4–B11 | Line G ÷ line C. |
| `grad_gap_4_to_6` | derived | — | `grad_rate_6yr − grad_rate_4yr`. Large gaps indicate a structurally extended program (co-op, required abroad, five-year norm). |
| `sections_under_20_pct` | pct | CDS I3 | (2–9 + 10–19) ÷ total sections. **Never report alone** — see §4. |
| `sections_50plus_pct` | pct | CDS I3 | (50–99 + 100+) ÷ total sections. Always paired with the above. |
| `subsections_per_1000_sections` | derived | CDS I3 | `(subsections ÷ sections) × 1000`. Measures whether the lecture+discussion model operates at all. |
| `humanities_share_pct` | pct | CDS J1 | Sum of English, history, foreign languages/literature, philosophy & religious studies, area/ethnic studies. Use this narrow definition consistently; broad "arts and sciences" definitions destroy comparability. |
| `top3_concentration_pct` | pct | CDS J1 | Sum of the three largest bachelor's-degree categories. |
| `greek_pct` | pct | CDS F1 | Report as a range if the source PDF extracts ambiguously (common). |
| `out_of_state_pct` | pct | CDS F1 | |
| `curriculum_type` | enum | CDS E3 | `core` \| `distribution` \| `competency` \| `open` |
| `has_cross_school_requirement` | bool | CDS E3 + catalog | **Added after run 2.** Does the general-education framework include a required shared text, common core sequence, or cross-college course? Two schools coded identically as `competency` differed entirely on this. |
| `undergrad_research_flagged` | bool | CDS E1 | Note: self-reported and sometimes wrong. One calibration school left it unchecked despite running a substantial program. Treat a `false` as a prompt to verify, not as a finding. |

### 3.2 Tier B — Countable, ~20–40 minutes each

| Field | Type | Source | Definition / derivation |
|---|---|---|---|
| `presence_continuity_pct` | pct, est. | Multiple | **The highest-value field in the schema.** Estimated share of degree-seeking upperclassmen physically on the primary campus in a typical fall term. See §3.4 for the derivation and required itemization. |
| `undergrad_orgs_active` | int | Org directory backend | Undergraduate organizations at the primary campus only. Exclude graduate orgs, club sports, Greek chapters, and satellite campuses unless separately itemized. **Never take the marketing figure.** |
| `orgs_per_1000_undergrads` | derived | — | `(undergrad_orgs_active ÷ undergraduates) × 1000`. **Unvalidated across institution sizes** — see §7. |
| `student_allocated_dollars` | currency | SG budget docs | Annual student-fee dollars allocated to organizations by a student body. |
| `student_allocated_per_undergrad` | derived | — | `student_allocated_dollars ÷ undergraduates`. **Do not read alone** — pair with `allocation_authority`. |
| `allocation_authority` | enum | Funding manual | `student_final` \| `student_recommends_admin_approves` \| `admin_controlled`. Added after run 2, when the school with more dollars per student also had materially more student autonomy and the raw dollar figure would have read backwards on its own. |
| `funding_demand_ratio` | derived | SG reports | `requested ÷ allocated`. Both calibration schools sat near 1.5, suggesting real competition rather than rubber-stamping. Values near 1.0 warrant scrutiny. |
| `paper_independent` | bool | Paper's own about/masthead | Financially *and* editorially independent of the university. **Screening filter, not a differentiator** — see §7. |
| `paper_founded` / `paper_independent_since` | year | — | Two distinct dates; record both. |
| `oldest_student_org_year` | year | Org sites | Oldest continuously student-run organization. Operationalizes the turnover test. |
| `new_orgs_recognized_3yr` | int | SG approval records | Student-founded organizations formally recognized in the last three years. |
| `study_abroad_participation_pct` | pct | Institutional/press | Share of undergraduates spending at least one term abroad. Input to presence-continuity. |
| `coop_participation_pct` | pct | Institutional | Share of graduates completing at least one co-op. Input to presence-continuity. |

### 3.3 Tier C — Qualitative, required, never scored

These carry the findings the numeric fields cannot reach. Each is a prose section with a minimum of three cited artifacts (see §5).

- `intellectual_culture_read` — synthesis of six weeks of the student paper's opinion section
- `governance_friction` — **added after run 2.** Documented instances of administrative constraint on student self-governance, organizational autonomy, or student expression, with the institution's stated position where available. Kept qualitative deliberately: scoring it would require adjudicating contested disputes, which is out of scope for a curation system.
- `notable_artifacts` — 3–5 specific, dated, named examples (a student-founded organization with its founding year, a specific recurring event, a specific student-taught course)

### 3.4 Derivation: `presence_continuity_pct`

Estimated share of student-terms spent physically on the primary campus, computed as `100% − Σ(deductions)`.

**Deductions to itemize separately (never report only the total):**
1. Co-op / cooperative education at full-time employment
2. Required or heavily normalized study abroad
3. Satellite- or partner-campus rotation programs, including first-year-abroad tracks
4. Off-campus residence beyond walking distance of the primary campus

**Method.** Convert each program to a fraction of student-terms: `(participation rate × terms per participant) ÷ total terms in the normative program`. Sum. Subtract.

**Worked examples from calibration:**
- School with ~45% doing one semester abroad out of eight: `(0.45 × 1) ÷ 8 ≈ 5.6%`. Presence ≈ **93%**.
- School with ~93% doing co-op, averaging ~2 six-month placements over a five-year program: `≈ 2 to 2.5 terms ÷ 10 ≈ 20–25%`, plus first-year-abroad tracks. Presence ≈ **72–78%**.

**Why composition matters and the scalar doesn't suffice.** A school losing 30% to study abroad behaves differently from one losing 30% to full-time employment. Study abroad returns students to campus with new material; co-op returns them on a six-month leadership-turnover cycle that resets organizations twice a year.

**Why this field exists separately from `offcampus_pct`.** In calibration, one school's 34% off-campus were largely in apartments a ten-minute walk from campus; the other's 43% included students working full-time in other cities. Identical CDS field, opposite behavioral meaning. Both fields are required.

**Confidence.** This is an estimate. Store the assumptions alongside the value, not just the number.

---

## 4. Fields that fail if used alone

Flag these in the UI. Each produced a wrong reading in calibration when read as a scalar.

| Field | Failure mode | Required pairing |
|---|---|---|
| `sections_under_20_pct` | A school can have more small sections *and* more large sections than its comparator, with a hollowed-out middle. | `sections_50plus_pct` |
| `student_allocated_per_undergrad` | More money can coexist with less student control; the ranking inverts. | `allocation_authority` |
| `offcampus_pct` | Cannot distinguish nearby apartments from full-time work in another city. | `presence_continuity_pct` |
| `curriculum_type` | Two structurally identical `competency` codings hid a real difference in cross-domain requirements. | `has_cross_school_requirement` |
| `grad_rate_6yr` | Hides the extended-program signature entirely. | `grad_rate_4yr` |

---

## 5. Record structure

Each school is one wiki record with three zones.

### 5.1 Structured header
All Tier A and Tier B fields. Every field carries:
- `value`
- `source_url`
- `source_type` — `cds` \| `ipeds` \| `institutional` \| `student_media` \| `press` \| `directory` \| `estimate`
- `as_of` — the reporting period of the underlying data, not the retrieval date
- `retrieved` — the retrieval date
- `confidence` — `reported` \| `derived` \| `estimated`
- `notes` — free text, required for anything `estimated`

**CDS lag warning.** Institutions publish sections with inconsistent lag; one calibration school's 2024–25 CDS reported Fall 2023 class-size data. Always record the underlying reporting period, not the CDS edition year, or the comparisons will be silently off by a year.

### 5.2 Exposition
Free prose, structured by the four sub-constructs from §1, plus `governance_friction`. This zone carries findings the schema cannot represent — and by design, will always exist. The system should not push toward eliminating it.

### 5.3 References
Every external source with:
- URL, title, publisher, publication date, retrieval date
- `tier` — 1, 2, or 3 per §2.1
- `provenance` — for student-media sources, whether the claim is a **news report** (verified by the paper), an **op-ed** (a student's own view), or a **letter to the editor** (a response). This distinction did substantive work in calibration: one school's op-ed drew a published rebuttal from an alumnus, and the *disagreement itself* was the finding. A system that flattens these into "sources" loses it.

---

## 6. Per-school workflow

Budget ~90 minutes for Tier A + B, plus ~60 minutes for Tier C.

1. **CDS sweep** — sections B, E, F, I, J. Note the reporting period of each section separately.
2. **Org directory backend** — filter counts, not the marketing number. Scroll the long tail; record 2–3 weird clubs with founding dates.
3. **Student government funding documents** — budget totals, fee amount, allocation authority, requested-vs-allocated.
4. **Presence-continuity inputs** — co-op rate, study abroad rate, satellite programs. Itemize.
5. **Events calendar** — one random mid-semester Tuesday; count and classify hosts.
6. **Student paper** — six consecutive weeks, October or February, opinion section included. This is the step that cannot be shortened.
7. **One recorded lecture Q&A** — watch the last fifteen minutes.
8. **Falsification pass** — run §2.3 against everything above before writing the record.

---

## 7. Known gaps and open calibration questions

Carry these forward; do not treat the schema as settled.

- **`orgs_per_1000_undergrads` is unvalidated across institution sizes.** Both calibration schools were large urban universities (18k–23k undergraduates) and landed at 20–25 per 1,000. A 1,600-student liberal arts college will produce a figure four or five times higher. **This may be genuine signal or a pure size artifact, and we do not currently know which.** Run a small residential college before trusting cross-size comparisons. Consider a size-band normalization or a peer-relative percentile.
- **`paper_independent` did no discriminating work** in a matched pair where both schools passed. It will screen out plenty of institutions, so keep it — but do not expect it to separate peers.
- **Intellectual culture is not measured at all.** It lives entirely in Tier C, and after two runs there is no candidate numeric proxy. Resist the temptation to invent one; a bad proxy here is worse than an honest gap.
- **Matched pairs vs. contrasts.** Run 2 used a matched control (same city, same campus type, similar scale) specifically to isolate the variables of interest from confounds. This validated the schema faster than a contrasting institution would have. Recommend alternating: matched pairs to test field sensitivity, contrasting types to test field range.
- **The engagement-failure taxonomy is incomplete.** Calibration surfaced two distinct failure modes — a transactional/incurious culture, and administrative constraint on expression. Both are engagement failures; they are not the same failure; and the schema currently distinguishes them only in prose. Expect more modes as coverage grows.

---

## 8. Extending the schema

When adding a new criterion (cost, outcomes, academic strength, location, etc.), apply the same discipline:

1. **Decompose first.** Ask whether the criterion is actually one variable. If a school can score high on one part and low on another, it is not one field.
2. **Rank sources by resistance to manipulation** before collecting anything.
3. **Write the falsification test before the field.** If you cannot state what evidence would make the field read wrong, the field is not ready.
4. **Test on a matched pair.** A field that cannot separate two similar schools is not measuring anything at that resolution.
5. **Add pairing constraints explicitly.** Any field that produced a wrong reading alone goes in the §4 table with its required companion.
6. **Let some things stay prose.** The system's value depends on the exposition zone remaining a first-class citizen, not a residue of what could not be structured.

### Naming and versioning
- Fields are `snake_case`, with `_pct`, `_year`, `_int`, `_bool` suffixes where the type is not obvious.
- Derived fields store their formula in the schema, not in the record.
- Version the schema itself. Records store `schema_version` so that adding or repairing a field does not silently invalidate earlier entries — and note in each record when a value was carried forward under an older definition.
