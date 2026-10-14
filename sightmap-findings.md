# Sightmap authoring — findings from mapping the calcifer web UI

Context: I (an AI coding agent) authored a full `.sightmap/` corpus for the
"hearth" web UI using the `sightmap-authoring` skill + `sightmap` CLI v0.26.1 on
Linux. This file records where the process/guidance steered me wrong or left me
guessing, with reproducible evidence, so it can feed back into the tools/skills.

The headline: I produced a **flat** corpus with no `$ref` cross-view references
and no component hierarchy. Both `$ref` and hierarchy (`children:`) turn out to
be **fully supported by the tool** — I just never learned they existed, because
the skill I was given never mentions them and every example is a flat list. This
is a documentation gap, not a tool gap.

---

## Finding 1 — Component hierarchy (`children:`) is supported but undocumented

### What the skill led me to believe
The `sightmap-authoring` SKILL.md:
- Shows the snap **output** as a tree (`SiteHeader` > `DesktopNavLink`), and
- Uses the phrase "**child component** that is a link or button must have at
  least one property," but
- Every **authoring** example is a single flat `components:` list.

The natural (wrong) inference: the tree is purely DOM-derived, T2 "scoped inside
a labeled container" happens automatically by DOM containment, and there is no
way to express parent/child *in the YAML*. So I declared everything flat and
leaned on automatic DOM scoping (which does work — I hit 0 orphaned).

### What's actually true (tested)
`children:` is a real, recognized field that creates nested components **and
scopes the child's selector to the parent's subtree.**

Evidence — the validator distinguishes `children:` from genuinely-unknown fields:

```
children:   → ✓ no errors (NOT flagged unknown)
parent:     → warning: unknown field "parent"
scope:      → warning: unknown field "scope"
components: (nested under a component) → warning: unknown field "components"
```

Evidence — children are first-class (counted + indexed with a breadcrumb path):

```
$ sightmap stats     → Components  4   (Sidebar + Brand + NavLink + Composer)
$ sightmap search 'Brand|NavLink'
    components.yaml › Sidebar › Brand
    components.yaml › Sidebar › NavLink
```

Evidence — `children:` **relativizes the selector to the parent** (the key
payoff). On a page with 16 total `button`s, 14 of them inside `nav.rail`:

```yaml
components:
  - name: Sidebar
    selector: 'nav.rail'
    children:
      - name: ChildBtn
        selector: 'button'      # generic!
```
```
$ sightmap snapshot   → ChildBtn  14      # scoped to Sidebar, not all 16
```

So a child selector only has to be unambiguous *within its parent*, not globally.

### Why this matters for the corpus I built
Several definitions are more verbose and more global than they should be:
- `SidebarBrand`, `NavCollapseButton`, `NewChatButton`, `ArchivedButton`,
  `SignOutButton` are only ever inside the rail. They should be
  `Sidebar › Brand`, `Sidebar › CollapseButton`, … with short relative
  selectors, instead of top-level globals.
- The **"repeated identical control needs a per-instance property"** rule bit me
  on `ArchiveRescueButton` (every row's Rescue button is identical), so I dropped
  it to T2. With hierarchy it's simply `ArchiveRow › RescueButton` with selector
  `button` — the parent (`ArchiveRow[title=…]`) supplies the discriminator and
  the child stays addressable. Same pattern fixes `ConversationItem`'s "⋯"
  button, tree/gallery stars, card actions, etc.

### Suggestion
- Add a short **"Component hierarchy"** section to the authoring skill showing
  the `children:` syntax, that child selectors are parent-scoped, and that this
  is the idiomatic fix for repeated-identical-control disambiguation.
- Clarify the coverage docs: T2 "scoped" happens by DOM containment *even for
  flat components*, but `children:` is how you express it in YAML and shorten
  selectors. Right now "child component" is used without ever defining how to
  make one.

---

## Finding 2 — `$ref` (cross-view references to globals) is supported but undocumented

### What the skill led me to believe
The skill says globals in `components.yaml` are "matched on every view," and
that's it. There is **no mention of `$ref`** anywhere. So I put the shared shell
in `components.yaml` and never referenced it from views. That is *correct* for a
genuinely-global rail (it's on every authed page), but it means a view file
doesn't record which globals actually appear on it — you can't tell from
`views/home.yaml` that the Sidebar is present there.

### What's actually true (tested)
`$ref` is a real, resolved reference mechanism:

```yaml
views:
  - name: Home
    route: "/"
    components:
      - $ref: Sidebar          # references a global by name
      - name: Composer
        selector: '.composer'
```
```
$ sightmap validate   → ✓ no validation errors      (and no "unknown field")
$ sightmap stats      → Home … Components 2          (the $ref counts)
$ sightmap search Sidebar → views/home.yaml [Home /] › $ref: Sidebar
```

It's genuinely resolved, not loosely accepted — a dangling ref hard-errors:

```
- $ref: NoSuchComponent
$ sightmap validate
  error: $ref "NoSuchComponent" does not resolve to any global component
```

Contrast: `ref:` (no `$`) → "unknown field" + "component is missing a name";
`uses: [Sidebar]` → "unknown field". So `$ref` specifically is the blessed form.

### Why this matters
As you noted: even when a component is genuinely global, an explicit `$ref` in a
view documents that it *can* appear there. For components that are on *most* but
not *all* views, `$ref` is the correct tool (vs. a global that then reports
"present in K of N" everywhere it's absent).

### Suggestion
- Document `$ref` in the authoring skill with the exact spelling (`$ref`, not
  `ref`/`uses`), that it resolves against `components.yaml` names, that dangling
  refs error, and the editorial guidance on when to `$ref` a global into a view
  vs. leave it purely global.

---

## Root-cause summary

I went flat + global-only because the skill's **examples are all flat**, its
**globals story is "put it in components.yaml, done,"** and neither `$ref` nor
`children:` appears in the text. The tool supports both; the guidance simply
doesn't surface them, and the one hint that hierarchy exists ("child component")
is never backed by syntax. An agent following the skill faithfully will never
discover these features — I only found them because you asked and I probed the
validator.

---

## Other process friction (from building this corpus)

1. **`sightmap network` / `console` are unreachable in this setup.** `browser
   start` (v0.26.1, Linux) brought up Chrome + CDP on `:7892` but **no HTTP
   daemon on `:7891`** (`ss` confirms nothing listening there). Everything
   CDP-based works (`snapshot`, `sel-probe`, `click`, `capture`), but the
   network/console classification tools fail with `connection refused`, so I
   authored `requests.yaml` from source and could not live-verify request
   matching. Either the overlay server isn't starting on Linux, or its start is
   silent/optional and the skill should say how to bring it up (and the tools
   should give a clearer error than a raw dial failure).

2. **Route-glob + URL-decoding behavior is undocumented and surprising.** I lost
   time here. Empirically: `*` matches exactly one path segment, `**` matches
   zero-or-more, and **sightmap decodes `%2F` before route-matching**. This app
   URL-encodes fs paths as a single segment (`/app/family-wiki/family%2FJay%2FJay.md`),
   which sightmap expands to 5 segments — so `/app/*/*` silently became "No view
   matched." The fix (`/app/*/*/**`) is non-obvious. The skill's route section
   says "`**` = any depth" but nothing about single-segment `*`, the zero-match
   behavior of `**`, or path decoding. Worth a short "route matching" subsection.

3. **The novelty gate is timing-sensitive and quietly cost me a good capture.**
   A capture taken mid-navigation (React had rendered breadcrumbs but not yet the
   tree rows) was saved as the tree baseline, so `TreeRow` reported "0 of 3
   snaps" (a false dead-selector). And an empty gallery load got gated as
   "nothing new." Both were only caught by eyeballing element counts before
   capturing. A `--wait`-until-stable option, or capturing element counts in the
   `capture` confirmation output, would help. At minimum the skill could warn
   "verify expected elements are present (e.g. via `browser eval
   'document.querySelectorAll(sel).length'`) before `capture`."

4. **`memory:` shape had to be reverse-engineered.** The skill mentions memory
   "lands in your context" and `stats` counts it, but never shows the YAML shape.
   I first tried a list of `{name, text}` objects → `cannot unmarshal !!map into
   string`. It's a **list of plain strings**, attachable at file-root (globals),
   per-view, and presumably per-component. One example in the skill would remove
   the guessing.

5. **The referenced deep docs weren't reachable.** The skill points to
   `go/README.md` and `docs/reference.md` "relative to this skill's directory,"
   but those paths don't exist in the installed skill on this machine (only
   `SKILL.md`). So the "full authoring reference" the skill defers to for the
   coverage/component model was unavailable — which is exactly where `$ref` and
   `children:` are presumably documented. If the skill relies on those files,
   they need to ship with it (or the key content folded into SKILL.md).

6. **Selector stability guidance is browser-generic.** The skill warns "avoid
   class selectors (volatile)." That's right for hashed/CSS-modules builds but
   wrong here — this app's classNames are hand-authored and stable, so class
   selectors were the correct, and only necessary, tool (I made zero code changes
   to disambiguate). A sentence acknowledging "stable, human-authored class
   names are fine; the risk is *generated/hashed* classes" would prevent
   unnecessary `data-*` churn.

---

## Net

The corpus is correct and passes `validate`/`lint` with 0 orphaned everywhere,
but it under-uses the tool: it should use `children:` to nest the obviously-owned
sub-components (and shorten their selectors) and could use `$ref` to record where
globals appear. Neither was a judgment call I made against the guidance — the
guidance never presented the options. The highest-leverage fixes are (1) an
authoring-skill section each for `children:` and `$ref`, (2) shipping the deep
reference docs, and (3) a short "route matching + URL decoding" note.

---

## Follow-up — learnings from actually refactoring to `children:` + `$ref`

I refactored the corpus to use hierarchy and cross-view refs (validate + lint
clean, 0 orphaned across 10 captured states, T1 rose from ~13-57% to 40-100%).
Five non-obvious behaviors surfaced that the docs should call out:

1. **`children:` scoping works by *prepending ancestor selectors*.** A child's
   effective selector is `<parent-sel> <child-sel>` (a descendant combinator),
   recursively. So nesting is what lets a child use a short relative selector
   (a collection tab becomes just `button` inside `.collection-tabs`) — but it
   also means deep trees produce long selectors. A 4-level nest
   (`Sidebar > ConversationItem > Menu > MenuAction`) tripped
   `lint [deep-nesting]: selector is deeply nested (≥4 levels)`. Fix: promote a
   singleton descendant (the menu popover — only one open, globally-unique
   selector) to a top-level component. Worth documenting the depth budget and
   the "promote singletons" pattern.

2. **Component QUERIES are single-component — hierarchy is not traversable in a
   query.** `TreeRow Star`, `TreeRow > Star`, and `TreeRow[name=…] Star` all
   resolve to *no component*; a bare duplicate child name (`Star`) matches all
   instances at once. So hierarchy helps coverage/annotation/relativized
   selectors, but does NOT make a child addressable *through* its parent. Two
   consequences the skill should state plainly:
   - Any control you drive individually needs a globally-unique name (or its own
     per-instance property). The parent's discriminator does not carry into a
     query. (This means the "repeated identical control → give it a per-instance
     property" rule is NOT solved by nesting alone.)
   - Per-instance leaves (row stars, rescue buttons) are fine to leave with
     generic/duplicate names and reach by their numeric snapshot id.

3. **`$ref` in a view makes coverage EXPECT that component there.** Auto-globals
   that happen to be absent from a view's captures are silently fine, but the
   moment you `$ref` one into a view, coverage flags it `— 0 of N snaps` (and a
   scoped child as `selector likely broken`) whenever that view's captures don't
   include it. So `$ref` is for components *reliably present* in the view's
   captured states (the persistent shell); transient overlays reachable from a
   page (a modal, a popover) should stay pure auto-globals, NOT be `$ref`'d into
   every view — otherwise you're forced to capture every overlay open on every
   view. This tradeoff isn't obvious and bit me on `ArchiveBrowser`.

4. **Names are unique-per-parent, not global.** Two children named `Star` under
   different parents validate fine and show distinct breadcrumb paths in
   `search` (`TreeRow › Star`, `GalleryTile › Star`). Combined with (2), the
   guidance is: reuse generic child names freely for coverage, but keep unique
   names for anything you query.

5. **`components.yaml` entries are auto-global even without `$ref`.** Confirmed a
   global matches every view with no reference, and `$ref`-ing it in addition is
   idempotent (Guide count stays 1 — no double-match, no conflict). So `$ref`'s
   role for a genuine global is purely *documentation of presence*; its load-
   bearing use is (a) recording which globals a view actually shows and (b) the
   coverage-expectation semantics in (3).

Net: hierarchy + `$ref` are clearly the intended "good" form and materially
improve annotation/T1, but three of their behaviors (selector concatenation +
depth limit, non-traversable queries, and `$ref`-implies-expected) are
load-bearing and currently undocumented. Each deserves a sentence or two in the
authoring skill.
