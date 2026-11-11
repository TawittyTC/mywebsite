# v2.65.0 hand-off: analysis done, implementation to finish

Written for the model that takes over. The owner asked for analysis only from here on; the
implementation is yours. Everything below was measured on this repository, not assumed.

Delete this folder (`.claude/handoff/`) in the release commit.

## 1. Where things stand

| | |
|---|---|
| Live site | v2.64.0, master at `7fedb6c`. https://tawittytc.github.io/mywebsite/ |
| Branch | `claude/update-code-certificate-cv45kf`. Never push anywhere else without the owner's say. |
| On the branch, NOT live | `d0787ba` hero copy centred on tablets, `8fd34d5` hero buttons, `f73fc16` rebuilt files, then this folder |
| Test suite on the branch | see section 7; with the hero tests it takes about 10 minutes |
| Version strings | still `?v=2.64.0` and `CACHE = 'v159'`; bump them only in the release commit |

Four items. A is implemented and unreleased. B and C have ready material in this folder. D is
not started. Do them in the order A, D, C, B (smallest risk first), one commit each, then release.

| Item | State | What is left |
|---|---|---|
| A. Hero buttons | implemented, pushed, own tests pass | independent check, pictures for the owner, release |
| B. No word breaks at a hyphen | script ready, not applied | apply, measure, write the test |
| C. Back to top leaves on touch | patch + 5 tests ready, not applied | apply, run the suite |
| D. Card row follows the finger | not started | 6 lines of JS + a test |

## 2. Rules that do not bend

The owner rejected and had reverted a whole polish pass. He judges changes one at a time.

- Keep exactly: blue `#1264CE` with greys, light theme, the hero constellation and its six
  labels (CRM POS ASR TTS LLM IVR), the name in a dark-to-blue gradient with shimmer, the
  uppercase eyebrow, the typed role line, the glow behind the name, section waves, the Liquid
  Glass business card and its sway, the card scroller with paddles and the round "+", its idle
  nudge, real company logos, "Let's build what's next."
- He hates: horizontal overflow, cards that look empty, unequal or awkward card heights, words
  breaking at hyphens, overlapping elements, invented facts, changed counts (33 clients, 58 projects).
- Never: reword copy, change colours, sizes, spacing or weights, calm or remove motion.
- A visible change he has not seen in a picture needs his go-ahead first. A, B, C, D have it
  (he answered "go on" to the hero picture and to the three recommended phone fixes). Nothing
  else in section 9 does.
- Privacy: never publish passwords, phone or extension numbers, customer or staff e-mails,
  internal hosts, prices, staff names. Never send his e-mail address or phone number to an
  outside service.
- Commits end with these two lines and carry no model name anywhere else:
  ```
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01LVMxFARS77T3Q4AVAS1Hq1
  ```
  (use your own session's attribution lines if your session gives you different ones)
- No pull request unless he asks. Report to him in Thai.

How the site is built: `index.html` has a large inline `<style>` and loads the BUILT files
`assets/css/style.min.css` and `assets/js/main.min.js`. Edit `assets/css/style.css` and
`assets/js/main.js`, then run `./build.sh` before any test. The stylesheet link comes after
the inline style, so style.css wins at equal specificity.

Tests: `CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` (about 6 minutes). One file:
`CHROMIUM_PATH=/opt/pw-browsers/chromium node --test tests/<file>.test.mjs`.
A new test must fail on the build without its fix. Prove it by reverting the fix once.

Traps met so far:
- Cards sit at scale .94 / opacity 0 until the scroll reveal settles. Use
  `reducedMotion: 'reduce'` when you only need layout.
- The hero entrance holds each line back up to 0.55 s and moves it 30px, also under reduced
  motion. Wait 900 ms before measuring hero geometry.
- The constellation is seeded with `Math.random` and never stands still. Seed it with
  `addInitScript`, sample over time, use several seeds. One frame proves nothing.
- A sheet or the viewer puts focus on its close button as it opens. Read a "resting" style
  only after a blur.
- Playwright `locator.click()` hangs on an endlessly animating element. Use
  `page.mouse.click` or `el.click()`.
- The service worker answers image requests from its cache. Open test pages with
  `serviceWorkers: 'block'` when a test delays or counts requests.
- Never `pkill`. Kill your own servers by PID.

## 3. Item A: hero buttons (done on the branch, to check and release)

What a visitor gets: under the typed role line, a blue pill "View projects" (scrolls to
`#portfolio`) and a text link "Download CV" (same file as the closing section's link). Same
size as the closing pair. Left-aligned on a desktop, centred on a phone, one row down to 320px.

What had to change with it, and why (all in `8fd34d5`, read its message):

1. Layout rules for the row are in the INLINE css of `index.html` (`#hero .hero-actions …`),
   not in style.css: the page is laid out and the constellation measures `.hero-copy` before
   the async stylesheet applies. `tests/layout-shift.test.mjs` fails if they drift apart.
   This also kept style.css within its size budget (section 8).
2. The glow (`#hero .hero-copy::before`) and the intro burst (`clusterPoint()` in main.js)
   were centred on the copy block, which is now 76px taller (68px on a phone). Both are
   pinned to the name again: `top: calc(50% - 38px)` / `calc(50% - 34px)`, and `nameRect`.
3. On a phone the six labelled nodes live in a band below the copy. `labelBand()` now starts
   the band 40 to 70px under the buttons and gives back at the bottom what it lost at the top
   (down to 4% from the edge). `placeSpecials()` places the six from stored jitter, opens the
   ring towards the band's edges when the band is short, and lowers only their up-and-down
   sway (`n.vy`) so two labels in one column keep apart. It runs in `makeNodes()` and when
   the layout is re-anchored.
4. A phone held sideways has no room under the copy: there the six stand three to a side
   (`beside` branch in `placeSpecials()`).
5. `isMobile()` now follows the stylesheet's breakpoint (`(max-width: 992px)`) instead of
   `W < 1025`. At 993 to 1024px the copy was already on the left (CSS) while the graph stayed
   in its phone composition, two labels hidden behind the copy; the buttons hid a third.
   This is a visible change at iPad-landscape width. Show him a picture of 1024x768.
6. Separate commit `d0787ba`: `#hero .hero-grid { margin: 0 }` pinned the hero column to the
   left edge from 576 to 992px wide (name 24px off centre on an iPad, 50px on an iPad Air,
   136px at 992px). Now `margin: 0 auto`. (Its commit also carries the phone glow offset by
   accident of how the hunk was staged; the final state is right.)

Labels a visitor can read (mean opacity over .6), three seeded loads per size, live site
against the branch. "sum" adds the six mean opacities (6.00 = all fully shown).

| screen | live | branch | | screen | live | branch |
|---|---|---|---|---|---|---|
| 320x568 | 1 (1.33) | 1 (1.89) | | 768x1024 | 5 (5.59) | 6 (5.90) |
| 360x640 | 3 (2.97), 4 overlaps | 4 (4.51) | | 820x1180 | 6 (6.00) | 6 (6.00) |
| 360x740 | 5 (4.76) | 5 (5.47) | | 844x390 | 3 (3.55), 25 overlaps | 6 (6.00) |
| 375x667 | 3 (3.46) | 5 (4.77) | | 993x700 | 4 (4.16) | 6 (5.60) |
| 390x664 | 3 (3.25) | 5 (4.69) | | 1024x768 | 4 (4.16) | 6 (5.44) |
| 390x844 | 6 (5.74) | 6 (5.82) | | 1100x800 | 4 (5.06) | 4 (5.06) |
| 414x896 | 6 (5.95) | 6 (5.92) | | 1280x720 | 6 (5.53) | 6 (5.53) |
| 430x932 | 6 (5.99) | 6 (5.97) | | 1440x900 | 6 (5.93) | 6 (5.93) |
| 600x960 | 6 (6.00) | 6 (5.98) | | 1920x1080 | 6 (5.88) | 6 (5.88) |

On the branch: 0 label-on-label, 0 label on the copy or buttons, 0 cut by the hero's edge, at
every size. Re-measure with `hero/measure-labels.cjs` (it expects the live build served on
port 8971 and the working tree on 8972: `python3 -m http.server PORT --bind 127.0.0.1
--directory DIR`; a checkout of master serves as the live build).

Known limits, say them to the owner rather than hide them:
- 320x568 still shows one label of six (it did before too). 568x320 sideways is not handled.
- On a short phone the six labelled nodes sway less up and down than before (never sideways
  less; the other 44 nodes are untouched). That is less motion in one narrow case, forced by
  the room. If he objects, the alternative is to let labels touch now and then.
- Desktop: the name moves up 38px (the copy block is centred and got taller).

Not done yet for A. No independent check has looked at this code:
1. Run the whole suite (section 7).
2. With the same seed, node homes at 1100px and wider must be identical to the live build
   (read `fx`, `fy` of the six labelled nodes on both sides). The means in the table agree to
   two decimals, which suggests so; confirm it.
3. Resize within one load across 992/993 both ways, 390x844 to 844x390 and back, 1024x768 to
   700x768: no script errors, no label on the copy, the buttons or another label afterwards.
4. Reduced motion: buttons visible, labels placed, nothing overlapping.
5. Stylesheet held back 3 s (`page.route` on `style.min.css`): the buttons' box does not move
   when it lands (the CLS test covers four sizes; look at 390x664 and 1024x768 too).
6. Keyboard: Tab order is skip link, View projects, Download CV, chevron. Pill keeps its
   980px focus corner, the link gets 6px.
7. Pictures for the owner, before and after, same seed: 390x844, 390x664, 820x1180, 1024x768,
   1440x900, 844x390. A capture script exists in the session's scratchpad only; rewrite it
   (seed `Math.random`, wait until `#hero .typed` reads `AI Engineer`, screenshot).

## 4. Item D: a card row follows the finger (not started)

Measured on v2.64.0 at 390x844, touch: the two rows (`#skill-scroller`, `#scroller`) nudge
80px and back every 3 s at 1024px and below. A finger that lands during a nudge is ignored:
`onUserScroll()` returns early while `isAnimating`, the nudge carries the row back under the
finger, and a 150px drag ends at about 100px (159px on a row at rest).

The change, in `createCardScroller` in `assets/js/main.js` (search `var onUserScroll`):

```js
    var onUserScroll = function (e) {
      // the nudge's own scroll events are not the visitor's; a finger or a wheel always is,
      // and a nudge in flight then stops on its next frame, where it is
      if (isAnimating && !(e && e.type !== 'scroll')) return;
      userScrolling = true;
      clearInterval(hintInterval);
      hintInterval = null;
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(function () {
        userScrolling = false;
        startHintLoop();
      }, 10000);
    };

    scroller.addEventListener('touchstart', onUserScroll, { passive: true });
    scroller.addEventListener('wheel', onUserScroll, { passive: true });
    scroller.addEventListener('scroll', onUserScroll, { passive: true });
```

Why it is enough: `forward()` and `back()` already test `userScrolling` on every frame and
stop. The `focusin` listener below calls `onUserScroll()` with no event after clearing
`isAnimating`, so it still passes.

Do NOT change how often, how far, how fast the row nudges, or when it resumes. A reviewer
proposed ending the nudge after two runs; that is calming motion, which he rejected.

Test (`tests/scroller-touch.test.mjs`), touch context, motion on (no nudge under reduced
motion): bring `#scroller` into view, poll `scrollLeft` until a nudge is in flight (between
10 and 70 and changing), then use real touch input through CDP
(`page.context().newCDPSession(page)`, `Input.dispatchTouchEvent` touchStart / touchMove /
touchEnd; a synthetic DOM TouchEvent does not scroll). Assert: 100 ms after touchStart, with
the finger still for 400 ms, `scrollLeft` does not move on its own; a 150px drag in about 10
moves shifts the row by at least 140px from where the finger found it. Control: the same
drag on a row at rest. If CDP touch cannot scroll the row in headless Chromium, say so and
assert only the first part with evidence that the frames stopped. Do not fake the drag.

## 5. Item C: Back to top leaves on a touch screen (patch and tests ready)

Measured on v2.64.0 at 390x844, touch: `#back-to-top` appears after a 30px upward scroll and
then stays until the next downward scroll (still there 11 s later). It sits at x 324-368,
y 778-822, the column of every round control: the row paddles (z-index 901 against the
button's 900, so a tap on the button's centre presses "Next project"), the certificate "+"
(73% covered), the Experience "+" (46%), the FAQ "+".

Decision: on touch screens it leaves 2 s after scrolling stops and returns on the next upward
scroll of more than 30px. Everything on a device that can hover stays as it is. No CSS change.

Material in `back-to-top/`:
- `main.js.patch`: made against `a07e0f6`. The hero work touched other parts of main.js, so
  `git apply --3way back-to-top/main.js.patch` should take; check the result by eye.
- `back-to-top.test.mjs`: 5 tests. On v2.64.0 tests 1 to 4 fail and test 5 (mouse) passes,
  as intended. Copy it to `tests/`.

Its author was stopped before the whole suite finished. Still to do:
1. Apply, `./build.sh`, run the five tests, then the whole suite.
2. Read the "turned phone" part of the patch (`wide`, `turned`): it stops a rotation from
   bringing the button out. It is the most intricate part; confirm test 4 fails without it,
   and drop it if it does not earn its lines.
3. Find out why the paddles are z-index 901 (`git log -S"z-index: 901" -- assets/css/style.css`).
   Leave z-indexes alone unless that was an accident.
4. main.min.js grows by roughly 450 bytes; 2.9KB is free (section 8).

## 6. Item B: no word breaks at a hyphen (script ready, not applied)

Measured on v2.64.0 (`hyphens/baseline-v2.64.0.txt`): breaks at a hyphen at every width from
320 to 2560px. On the page itself 8 to 13 on phones ("multi- / agent", "speech- /
to-speech", "ORM- / backed", "AI- / powered", "Question- / Answering"), still 2 at 1440px.
In the overlays 43 to 115 on phones, 48 at 1440px. 1061 hyphens were looked at per width.

Decision: the site's own convention, `<span class="nw">` (`.nw { white-space: nowrap }`
already exists; `tests/interactions.test.mjs` already demands it for project card titles).
Not U+2011: it changes the text for search, copy-paste and find-in-page, and the self-hosted
font may lack the glyph.

Material in `hyphens/`:
- `wrap.py IN OUT [--skip "word@line" …]` wraps compounds in text nodes only and proves it
  changed nothing else. On the current `index.html` it wraps 192 compounds (123 distinct)
  and leaves 22: those already inside `.nw` / `.svc-nw`, chips that are nowrap by their own
  rule (`.skill-tools li`, `.svc-chips li`), the pills under `.exp-modal-tech` (a nested
  span there would be restyled as a pill), and the LinkedIn address (must stay breakable).
- `measure.mjs`, `inpage.js`, `report.mjs`: open the page and every overlay at 16 widths and
  report breaks, overflow, `.nw` spans that do not fit, and row heights.
  `node measure.mjs <siteRoot> out.json [widths]`, then `node report.mjs out.json`.
  (`measure.mjs` has `/home/user/mywebsite/node_modules` hard-coded.)
- `scan.py`: lists compounds per text node, for review.

Still to do:
1. `python3 hyphens/wrap.py index.html index.html.new`, review the diff, replace.
2. Measure at all 16 widths. Required: zero breaks at a hyphen between letters or digits;
   document `scrollWidth` equals the viewport; no overlay panel wider than itself; no `.nw`
   span wider than the content box of its block (if one cannot fit at some width, leave that
   occurrence unwrapped with `--skip` and tell the owner which); cards in one row keep equal
   heights. The author's own after-measurement was cut off, so none of this is confirmed.
   Watch large headings at 320px: "Question-Answering" in a resume role title is the likely
   one that will not fit.
3. List every element whose height changes against v2.64.0 at 320, 360, 390, 430, 768,
   1024, 1440, 1920. A few paragraphs will gain or lose a line. Nothing may be cut or overlap.
4. Text built by JavaScript (the See-all projects list in main.js builds rows from card
   text): measure it too. If a compound breaks there, wrap it where the HTML is built. Do
   not run a pass over the whole DOM at load: it would shift layout after first paint.
5. The typed hero line ("Full-Stack Developer") did not break at any width in the baseline.
6. Existing tests that read `index.html` with a regex may trip on a phrase a span now
   splits. Make such a test read text content; do not weaken what it checks.
7. Write `tests/hyphens.test.mjs`: at 320, 390, 430, 768, 1440 on the page (FAQ open) and in
   the overlays, assert zero breaks (Range rects: compare the top of the character at the
   hyphen with the next one) and no overflow, with an explicit allow-list for address-like
   strings. It must fail on v2.64.0 and name the broken words.
8. The body's `textContent`, and each template's, must be identical before and after.

## 7. Releasing v2.65.0

1. `./build.sh`, then the whole suite. State of the branch when this was written:
   106 tests, 105 pass, 1 fails, in 8 min 53 s (the hero file adds about 4 minutes).
   The failure is `the hero is laid out the same before the stylesheet arrives`
   (tests/responsive.test.mjs:300) at 1440x900: the name line read y 334 without the
   stylesheet and 304 with it. Run alone it passes 4 of 4, and measured by hand the hero's
   boxes, the new row included, are identical with and without the stylesheet at 1440x900
   and 390x844. Cause: the test reads the boxes at whatever moment the page finished
   loading, while each line is still held back by its entrance delay (0.1 s for the name,
   0.4 s for eyebrow and role, 0.55 s for the row) and sits 30px low until then; reduced
   motion shortens the animation, not the delay. Two loads can land on either side of a
   delay. The race was there before; a loaded machine makes it show.
   Fix in the test, on both loads: after `document.fonts.ready` wait until the entrance is
   over (`await page.waitForTimeout(900)`, or until `document.getAnimations()` is empty),
   then read. Do not loosen the comparison. Add `#hero .hero-actions` and its two children
   to the test's `parts` while you are there.
   One small gap in the inline copy of the row's CSS: `.chev` has no height before the
   stylesheet (0 against 12px). It moves nothing (the link's box is 117x44 both ways);
   adding `height: .72em` to `#hero .hero-actions .chev` in index.html closes it.
2. Bump `?v=2.64.0` to `?v=2.65.0` (4 places in index.html, 2 in sw.js) and
   `const CACHE = 'v159'` to `'v160'` in sw.js. `./build.sh` again. Delete `.claude/handoff/`.
3. Merge without fast-forward in a separate worktree, never on the branch checkout:
   ```
   git fetch origin master && git checkout --detach origin/master
   git merge --no-ff claude/update-code-certificate-cv45kf -m "Merge v2.65.0: …"
   git push origin HEAD:master
   ```
4. Check the two workflow runs on master ("pages build and deployment", "Site tests"), then
   the live site (a first fetch can hit a stale edge; fetch again). The min files on the live
   site should have the byte sizes of the built ones.
5. Report in Thai with before/after pictures, and say plainly what changed in look.

## 8. Size budgets, and what to sweep

`tests/integrity.test.mjs`: style.min.css at most 66KB (67,584 bytes), main.min.js 45KB.
Now: style.min.css 67,564 bytes (20 bytes free), main.min.js 43,158 (2,922 free).

Any new CSS rule breaks the budget. The test's comment says dead rules are swept before the
budget is raised. These twelve rules are dead today: their class appears nowhere in
index.html nor in main.js (`css/dead-rules.cjs` lists them; it expects the tree on port
8972). All are Bootstrap utilities that were merged into style.css:

`.rounded-circle`, `.mb-4`, `.d-block`, `.d-none`, `.mt-5` (two rules), `.p-4`, `.m-5`,
`.w-75`, and inside `@media (min-width: 768px)`: `.col-md-6`, `.d-md-flex`, `.d-md-none`.

About 350 bytes minified. Before deleting one, grep its class once more in index.html,
main.js and the tests. A class used only as part of a longer name does not count as a use.

Also dead but harmless, left from earlier work: the `'#skill .boxWhyScg'` entry in `GROUPS`
(main.js), and in the inline CSS the Experience card's `::before` shadow layer, its
`translateY(-3px)` hover and its shimmer rules, all overridden by style.css.

## 9. Proposed, NOT approved: each needs a picture and his go-ahead first

From the phone review:
- Experience sheet on a phone opens on 40 skill tags; the "33 clients" sentence is at the
  bottom edge. Idea: move the Skills block below the client list in the phone branch of main.js.
- Sheet text is 13px with 11px tags on phones. Idea: 16px / 13px, title 24px.
- From 600 to 767px the page shrinks to a 470px column (Bootstrap container 540px).
- One Skills card sets the height of all twelve; the others carry a blank band. Idea:
  reorder that card's tags so they take two rows.
- The Projects row holds all 58 cards on a phone: 57 swipes to the last one.

From the comparison with Apple's product pages: a slim sticky bar after the hero;
Certificates is 26% of the page (show 6 plus a link, or one row); stat numbers 30px to 48px;
phone prose 13px to 17px; Projects higher up; Education and Achievement side by side (its
prototype broke "Question-Answering" at the hyphen); scroller snap; next/previous in the
certificate viewer.

Never propose again (rejected): solid name, no glow, sentence-case eyebrow, static role
line, calmed motion, tighter section spacing, different Contact wording, copy-tone rewrites,
700 to 600 weights.

## 10. Open questions for the owner

1. The Kijsiri logo file reads "KITSIRI ASSET"; the site spells the company "Kijsiri Asset
   Co., Ltd.". In the Experience sheet the two now sit one above the other. Which is right?
   Asked twice, not answered. Do not change either on a guess.
2. Eight client sections have a logo file but show no logo (TSR, Thaivan, Aioi, iShopping,
   dp a&h, Dr.Orn, Poch, R&D). Add them?
3. The CV says "Collection CRM", the site "Sales campaign CRM"; the "60+ customizations"
   figure and the Mediviss description are unverified.
4. He may prefer the sheet logos beside the name (as designed before v2.64.0) to above it.
   One CSS rule: `.exp-client-section-header img` in index.html.
