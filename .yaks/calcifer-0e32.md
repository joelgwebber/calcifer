---
id: calcifer-0e32
title: 'annas MCP server: plain-fetch scraping broken by mirror bot-protection — needs a real browser'
status: shaving
type: bug
priority: 2
created: '2026-09-10T22:35:00Z'
updated: '2026-09-11T00:00:01Z'
labels:
- annas
- mcp-tools
---

`annas_search_books` (in `container/agent-runner/src/annas-mcp-stdio.ts`, deployed to
`/app/src/annas-mcp-stdio.ts`) does a bare `fetch()` + cheerio scrape of Anna's Archive's
search HTML, with no cookie jar and no JS execution. This no longer works against the
current mirror landscape:

- **`annas-archive.gd`** (current `ANNAS_BASE_URL` default) — DDoS-Guard now serves a
  302 to a `?check=1` page that requires a **manual CAPTCHA** (embedded in an iframe),
  not just a JS auto-check. A plain `fetch` (and even a real headless browser without
  a human/captcha-solving step) gets stuck here — every search comes back as a 403 or
  the check page.
- **`annas-archive.li`** — turned out to be a parked/for-sale domain, not Anna's Archive
  at all. Its odd redirect script is just parking-page fingerprinting, a dead end.
- **`annas-archive.org` / `.se`** — both returning 502 as of this writing (may be
  transient upstream trouble, not our issue to fix).
- **`aa.gl`** — Joel manually verified by hand that this mirror is currently up and has
  the books in question. Not currently tried as `ANNAS_BASE_URL`.

Root cause: the tool was built as a static HTML scrape assuming no bot-protection layer.
That assumption is now false for at least the default mirror. Confirmed via `agent-browser`
(a real, JS-executing browser) that a plain fetch/cheerio approach can't clear DDoS-Guard's
challenge — the fix needs the MCP server itself to drive a real browser (e.g. Playwright),
not just point at a different URL.

**Fix direction:**
1. Rework `annas-mcp-stdio.ts`'s search step (and possibly download) to drive a headless
   browser (Playwright) with a persistent context/cookie jar, instead of raw `fetch`, so it
   can pass JS-based auto-checks the way `agent-browser` did against `.li`'s parking script.
   Note this still won't clear a *manual* CAPTCHA wall like `.gd`'s — mirror choice matters.
2. Make `ANNAS_BASE_URL` easy to swap/try multiple mirrors (maybe try a short candidate list
   in order, skipping ones that 502 or hit a manual-CAPTCHA wall) rather than hardcoding
   `annas-archive.gd`. Try `aa.gl` as a candidate.
3. Consider: if no mirror is scrapeable without solving a CAPTCHA, the tool may need a
   documented "no automated path right now" failure mode rather than silently 403ing.

---
▸ 2026-09-10T23:01:33Z [Joel Webber]
Browser investigation via sightmap (real Chrome, JS-executing). Confirmed the wall is a MANUAL image CAPTCHA, not a JS auto-check — so a real browser alone does NOT fix this.

Mirror survey (from this host):
- annas-archive.gl: homepage loads fine (no challenge). But /search 302-redirects to ?check=1 -> DDoS-Guard 'I am not a robot' checkbox; clicking it (sets __ddg* cookies) escalates to a distorted-text image CAPTCHA (Complete the captcha / Type the text / Verify). 0 /md5/ results while walled. Same class of wall as .gd.
- aa.gl: was Joel shorthand, not a real mirror. It wedged the tab (redirect loop / blocking anti-bot script) and hung page-context calls. Ignore.
- annas-archive.se and annas-archive.org: DNS_PROBE_FINISHED_NXDOMAIN from this host (DNS-blocked). Not reachable here at all.

So: search is CAPTCHA-walled on every reachable mirror. This refines fix-direction #1 in the body — Playwright/persistent-context is necessary but NOT sufficient; something has to actually solve the image CAPTCHA.

Design direction agreed with Joel:
1. Try solving the CAPTCHA with a Claude vision model. Honest assessment: these are adversarial overlapping multi-color glyphs designed to beat OCR; a vision model may sometimes read them but reliability is low and it is a moving target. Worth a cheap attempt, not something to depend on.
2. Fallback: kick it back to the human via the web UI.

Card-affordance reality check (container/agent-runner/src/mcp-tools/interactive.ts) for whoever implements the fallback: today we have ask_user_question (BLOCKING, multiple-choice buttons only, no free-text, no inline image; default 300s timeout) and send_card / send_record_card (display-only, URL buttons only, no inline image). So a clean 'here is the captcha image, type the text' single-call flow is NOT supported by current primitives. Near-term it would be a two-turn flow (agent sends the screenshot as an image message + instructions, user replies with the text, agent types it into the browser and clicks Verify), or we add a free-text + image interactive card.

Persistence is the payoff: once the CAPTCHA is solved (vision or human), the __ddg* cookies live in a persistent Chrome profile and later searches ride them until expiry. That cross-cuts into new yak calcifer-d902 (persistent-profile + sightmap install/use).

Also still untested and worth checking before big changes: the download path uses /dyn/api/fast_download.json with the donor ANNAS_SECRET_KEY and may NOT be behind DDoS-Guard the way /search is — download might still work via plain fetch even when search is walled.

---
▸ 2026-09-10T23:28:45Z [Joel Webber]
IMPLEMENTED the captcha flow. Reworked container/agent-runner/src/annas-mcp-stdio.ts from bare fetch+cheerio to a persistent-profile Chromium via playwright-core (1.63.0, pinned; uses the image chromium at PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, --no-sandbox since the image runs unprivileged). New shape:
- annas_search_books: drives a real browser, tries mirrors in order (ANNAS_BASE_URL now accepts a comma list; default annas-archive.gl,annas-archive.gd), remembers the first that loads. Returns results if present; on a DDoS-Guard wall it clicks the checkbox, reads the CAPTCHA image and returns it as an inline MCP image block + saves it to /tmp/annas-captcha.png + stores the pending search.
- annas_solve_captcha(answer): fills .ddg-modal__input, clicks .ddg-modal__submit, waits, returns results on success; on a rejected answer returns a FRESH captcha image to retry.
- annas_download_book: unchanged (donor fast_download.json via fetch).
Agent is the vision/human bridge (it cannot see the MCP process's browser): reads the inline image itself, or relays /tmp/annas-captcha.png to the user for a type-the-text reply. library SKILL.md updated to teach this.

DDoS-Guard DOM reverse-engineered on the host: same-origin srcdoc #ddg-iframe with stable selectors .ddg-captcha__checkbox / .ddg-modal__captcha-image (a data:image/png;base64 URL) / .ddg-modal__input / .ddg-modal__submit.

VALIDATED end-to-end on the real site (annas-archive.gl) via the host sightmap browser, using the exact selector sequence the Playwright code encodes:
- checkbox -> image captcha modal appears.
- wrong answer (srf2d) -> cycles to a fresh checkbox challenge (the retry path).
- correct answer (xbchy, read by vision) -> 116 /md5/ results, iframe gone.
- persistence confirmed: a second, unrelated search (project hail mary) went STRAIGHT to results, no captcha, because the __ddg* cookies persisted in the browser profile. This is the solve-once-then-ride-cookies premise.

Container typecheck passes (tsc -p container/agent-runner/tsconfig.json). playwright-core added to package.json + bun.lock (bun install, single package, no browser download).

REMAINING before shearing:
1. Rebuild the agent image — the new bun dep (playwright-core) is baked into /app/node_modules; source is RO-mounted so the .ts change alone does NOT need a rebuild, but the DEP does. Without a rebuild the server crashes with Cannot find module playwright-core in a --rm container with no logs. Run ./container/build.sh.
2. Live container test: run a real annas_search_books in a container to confirm playwright-core launches against the distro chromium (the one thing not testable from the host) and the inline-image handoff renders for the agent.
3. Open question: does headless chromium in the container get fingerprinted harder by DDoS-Guard than the host Chrome did? If it always fails the checkbox, may need extra stealth args or a headful xvfb. Watch for this on first live run.
Left shaving pending container validation.

---
▸ 2026-09-10T23:47:13Z [Joel Webber]
CONTAINER-VALIDATED (built image nanoclaw-agent-v2, ran the real MCP server via an MCP stdio client smoke harness inside the image; source RO-mounted so .ts iterations needed no rebuild):
- playwright-core 1.63.0 launches against the image distro chromium (/usr/bin/chromium) with --no-sandbox. The main compat risk is cleared: no CDP/version mismatch.
- annas_search_books runs end-to-end and returns RELEVANT results (verified 'the left hand of darkness' -> 50 Le Guin hits with author/format/year/md5).

Discovered + fixed a SECOND, latent bug while validating (the tool would have returned garbage even past bot-protection):
1. Anna's Archive server-renders each result row INSIDE an HTML comment and un-comments it via JS on scroll. cheerio does not descend into comment nodes, so the old parser never saw real results.
2. The only md5 links cheerio DID see were the header's 'recent downloads' ticker (.js-recent-downloads-container) -- present on every page -- so the old parser returned unrelated books as 'results'.
3. Each result also has TWO md5 anchors (cover image link with no text + the title link); the old dedup kept the first (cover) -> empty titles.
Fix: strip HTML comment markers before cheerio.load, remove the ticker, key off the text-bearing title anchor, and read author/year/format from the text column (font-mono path line gives the extension; first /search?q= link is the author; year from the bibliographic /search lines, falling back to path). Result 1 now shows the real pub year 1969, not the collection path year.

Also fixed DDoS-Guard detection: check=1 and the DDOS-GUARD title both PERSIST on the passed results page, so wall detection now keys only on #ddg-iframe presence; waitForOutcome (now 30s) waits THROUGH the no-interaction auto-check ('Checking your browser... opens automatically') until it lands on results or escalates to the #ddg-iframe checkbox.

Container typecheck passes. Image rebuilt (playwright-core baked). NOTE: building required a one-time ./container/sync-yaks.sh first (the checkout was missing the vendored tools/yaks/yak.py the build preflight gates on; upstream yaks dropped its commands/ dir so that script errors after copying yak.py+yaklib, which is all the build needs).

RESIDUAL (one branch not exercised in-container): DDoS-Guard served the container the AUTO-CHECK variant, not the manual checkbox, so the in-container manual-CAPTCHA path (click checkbox -> read image -> return inline MCP image block -> annas_solve_captcha) was NOT triggered live. It IS fully validated on the host (real Chrome, identical srcdoc selectors: solved a real captcha 'xbchy' -> results; wrong answer -> fresh challenge; cookies persisted across searches). The unverified bits are purely (a) whether headless-in-container gets escalated to the manual captcha at all for this IP, and (b) that the agent SDK renders the returned inline image for the agent's vision. Left shaving pending a real agent-session run that hits the manual captcha.

---
▸ 2026-09-10T23:59:00Z [Calcifer, live agent session]
Real first-use validation: Joel asked for two books ("There Is No Antimemetics Division", "How Music Works") from a live agent session. `annas_search_books` worked end-to-end on the first call with NO captcha shown — got 50 and 43 results respectively, real titles/authors/years/md5s (confirms the comment-unwrapping parser fix too). `annas_download_book` fetched both epubs fine, uploaded to reMarkable successfully.

So this exercised the happy path (auto-check passed silently, no wall) in a genuine agent session, but STILL not the manual-CAPTCHA + `annas_solve_captcha` branch specifically — DDoS-Guard didn't escalate for this request. Leaving in shaving until that branch gets a live run; functionally the tool is working for real usage in the meantime.

---
▸ 2026-09-11T00:00:01Z [Joel Webber]
Live agent session (Calcifer) confirmed the happy path end-to-end: searched, downloaded, sent two books to reMarkable; DDoS-Guard passed silently (auto-check), no captcha.

Tried to deliberately re-trigger the manual captcha from the container to exercise the human-handoff branch live; could NOT summon it:
- Fresh-profile search on both annas-archive.gl and annas-archive.gd -> straight to results (auto-check passes silently). So clearing the profile does not trigger it.
- A modest rapid burst (8 searches, one profile) -> auto-check kept passing, never escalated to #ddg-iframe.
Conclusion: from this install's current egress IP + fresh headless fingerprint, DDoS-Guard stays in the straight-through / silent-auto-check tier. The manual checkbox+image tier is gated on reputation/rate/fingerprint state we can't easily force (the host browser earlier got stuck on manual most likely because its __ddg cookies were flagged after I refreshed/failed challenges repeatedly). So the manual-captcha branch remains unexercised in a live container session, not for lack of trying.

The branch mechanics are still fully validated on the host (real challenge: checkbox -> image -> solved 'xbchy' -> results; wrong answer -> fresh challenge; cookie persistence). The only truly unverified integration point is the MCP inline-image -> agent-vision -> annas_solve_captcha round-trip in a real session.

Options to close it out: (a) accept host validation + wait for it to occur naturally in the wild (code handles it), or (b) build a deterministic local fixture that serves the exact DDoS-Guard srcdoc DOM (#ddg-iframe + .ddg-captcha__checkbox/.ddg-modal__captcha-image/.ddg-modal__input/.ddg-modal__submit) so readCaptchaImage/submitCaptcha and the captcha_required handoff can be regression-tested offline without depending on DDoS-Guard's mood.
