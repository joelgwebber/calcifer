# Criterion: Student engagement & campus life

**Status:** Draft v0.1 — calibrated on Northeastern University and Boston University.
**Scope:** the *student engagement* criterion only. The cross-cutting evidence model
(source tiers, sampling discipline, record structure) lives in the skill manual; this
doc is the engagement-specific decomposition, its falsification tests, its fields, and
its open calibration questions. Machine-readable field defs are in `../schema.yml`
under `criteria.engagement`.

## 1. What this measures, and why it decomposes

The target construct is **authentic student engagement**: students deeply involved with
ideas, organizations, faculty, and community by their own initiative — as distinct from
institutions that *purchase* the appearance of engagement through high-profile
programming.

Engagement is not one variable. Treating it as one produces a single score that averages
away the finding. It decomposes into four sub-constructs that correlate imperfectly and
whose evidence lives in different places:

| Sub-construct | What it means | Where evidence lives |
|---|---|---|
| **Voluntary intellectual life** | Students attend talks, reading groups, events nobody required | Student paper opinion pages; recorded lecture Q&A; events calendar |
| **Organizational density** | Students found things, and those things survive leadership turnover | Org directory backend; founding dates; club social recency |
| **Faculty access** | Out-of-class contact is normal rather than exceptional | Class-size distribution; subsection ratio; undergrad research programs |
| **Civic embeddedness** | Sustained local involvement, not one-day service | Local press; service-program structure; co-op/internship civic placements |

**Calibration finding:** a school can score at the top of one sub-construct and the
bottom of another. Both test schools were strong on organizational density and
weak-to-ambiguous on voluntary intellectual life. Any system that collapses these into
one number reports both as "middling" and destroys the actual result. This is why the
prose exposition (one section per sub-construct) is mandatory and unscored.

## 2. Falsification tests

Run these before accepting any positive engagement finding.

- **Marketing-vs-backend test.** Compare the headline org count to the directory's own
  filter counts. In calibration this exposed a ~25% overstatement, with graduate orgs,
  club sports, Greek chapters, and satellite campuses folded into an undergraduate figure.
- **Long-tail test.** Does the 400-person headliner have a 20-person analog? Culture lives
  in the small events.
- **Turnover test.** Has a student-run org survived 10+ years across four complete
  generations of leadership? Longevity through turnover is culture; a three-year-old
  initiative is a grant.
- **Incentive test.** Is attendance driven by free food, class credit, or a convocation
  requirement?
- **Non-admissions search.** Search the domain excluding `/admissions` and `/news`. If the
  engagement only appears in marketing copy, that is the answer.
- **Weird-club test.** Scroll the directory's long tail. Generic clubs exist everywhere; a
  mycology society or a standing reading group means students are building things unprompted.

## 3. Fields

Full definitions, types, sources, and pairings are in `../schema.yml`. Notes that don't
fit the schema:

- **Tier A** (hard, published, ~20 min/school from the CDS): housing/off-campus split,
  4- and 6-year grad rates, class-size distribution, subsection ratio, humanities share,
  concentration, Greek %, out-of-state %, curriculum type + cross-school requirement,
  undergrad-research flag.
- **Tier B** (countable, ~20-40 min each): `presence_continuity_pct` (highest-value; see
  §4), active undergrad org count (backend, not marketing), student-government allocation
  dollars + authority + demand ratio, paper independence + dates, oldest org year, newly
  recognized orgs, study-abroad and co-op rates.
- **Tier C** (prose, required, never scored): the four sub-construct sections plus
  `governance_friction` and `notable_artifacts` (see `schema.yml` prose_sections).

`governance_friction` is kept qualitative deliberately: scoring it would require
adjudicating contested disputes, which is out of scope for a curation system. Document
instances of administrative constraint on student self-governance, organizational
autonomy, or expression, with the institution's stated position where available.

## 4. Derivation: `presence_continuity_pct`

Estimated share of student-terms spent physically on the primary campus, computed as
`100% − Σ(deductions)`.

**Deductions to itemize separately (never report only the total):**
1. Co-op / cooperative education at full-time employment
2. Required or heavily normalized study abroad
3. Satellite- or partner-campus rotation programs, including first-year-abroad tracks
4. Off-campus residence beyond walking distance of the primary campus

**Method.** Convert each program to a fraction of student-terms:
`(participation rate × terms per participant) ÷ total terms in the normative program`.
Sum. Subtract.

**Worked examples from calibration:**
- ~45% doing one semester abroad out of eight: `(0.45 × 1) ÷ 8 ≈ 5.6%`. Presence ≈ **93%**.
- ~93% doing co-op, averaging ~2 six-month placements over a five-year program:
  `≈ 2 to 2.5 terms ÷ 10 ≈ 20-25%`, plus first-year-abroad tracks. Presence ≈ **72-78%**.

**Why composition matters.** A school losing 30% to study abroad behaves differently from
one losing 30% to full-time employment. Study abroad returns students with new material;
co-op returns them on a six-month leadership-turnover cycle that resets orgs twice a year.

**Why this exists separately from `offcampus_pct`.** In calibration, one school's 34%
off-campus were largely in apartments a ten-minute walk from campus; the other's 43%
included students working full-time in other cities. Identical CDS field, opposite
behavioral meaning. Both fields are required — hence the §4 pairing.

**Confidence.** This is an estimate. Store the assumptions in `notes`, not just the number.

## 5. Never read alone (this criterion's §4 pairings)

Encoded as `pair_with` in `schema.yml`; the tool enforces them.

| Field | Failure mode alone | Required companion |
|---|---|---|
| `sections_under_20_pct` | More small *and* more large sections, hollow middle | `sections_50plus_pct` |
| `student_allocated_per_undergrad` | More money can coexist with less student control | `allocation_authority` |
| `offcampus_pct` | Can't distinguish nearby apartments from full-time work elsewhere | `presence_continuity_pct` |
| `curriculum_type` | Two identical `competency` codings hid a real difference | `has_cross_school_requirement` |
| `grad_rate_6yr` | Hides the extended-program signature | `grad_rate_4yr` |

## 6. Per-school workflow (engagement)

Budget ~90 min for Tier A + B, ~60 min for Tier C.

1. **CDS sweep** — sections B, E, F, I, J. Note each section's reporting period separately.
2. **Org directory backend** — filter counts, not the marketing number. Scroll the long
   tail; record 2-3 weird clubs with founding dates.
3. **Student-government funding documents** — budget totals, fee amount, allocation
   authority, requested-vs-allocated.
4. **Presence-continuity inputs** — co-op rate, study-abroad rate, satellite programs. Itemize.
5. **Events calendar** — one random mid-semester Tuesday (week 9); count and classify hosts
   (academic department / student org / administration).
6. **Student paper** — six consecutive weeks, October or February, opinion section included.
   This is the step that cannot be shortened.
7. **One recorded lecture Q&A** — watch (or read the transcript of) the last fifteen minutes.
8. **Falsification pass** — run §2 against everything above before writing the record.

## 7. Open calibration questions (carry forward — the schema is not settled)

- **`orgs_per_1000_undergrads` is unvalidated across institution sizes.** Both calibration
  schools were large urban universities (18k-23k undergrads) and landed at 20-25 per 1,000.
  A 1,600-student liberal-arts college will produce a figure four or five times higher. This
  may be genuine signal or a pure size artifact — we do not yet know which. Run a small
  residential college before trusting cross-size comparisons; consider a size-band
  normalization or peer-relative percentile.
- **`paper_independent` did no discriminating work** in a matched pair where both passed. It
  screens out plenty of institutions, so keep it — but don't expect it to separate peers.
- **Intellectual culture is not measured numerically at all.** It lives entirely in Tier C,
  and after two runs there is no candidate numeric proxy. Resist inventing one; a bad proxy
  here is worse than an honest gap.
- **Matched pairs vs. contrasts.** Run 2 used a matched control (same city, campus type,
  scale) to isolate the variables from confounds; this validated the schema faster than a
  contrast would. Alternate: matched pairs to test field sensitivity, contrasting types to
  test field range.
- **The engagement-failure taxonomy is incomplete.** Calibration surfaced two distinct
  failure modes — a transactional/incurious culture, and administrative constraint on
  expression. Both are engagement failures; they are not the same; the schema currently
  distinguishes them only in prose. Expect more modes as coverage grows.
