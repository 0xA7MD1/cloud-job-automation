# ui — Landing page + UI refresh (black & white, RTL)

## Waiting on Ahmed
- [ ] 2026-10-10 · decision · Thmanyah font for all visitors? Its license bans hosting/redistributing the files and modifying them (no woff2). Web embedding is allowed only "as part of a compiled/packaged product". The repo is going open-source → the files can't be committed. Now: loaded with CSS `local()` only → your laptop shows Thmanyah, everyone else sees IBM Plex Sans Arabic.
  1. A: email `ask@thmanyah.com` for written OK to serve the fonts from the hosted app (files kept out of the public repo)
  2. B: stay local-only (as now)
  3. C: switch to an open-license Arabic serif for h1/h2
  **Recommendation: A** (keep B until they reply).
- [x] 2026-10-10 · check · Header hidden at the top? → **No: links/buttons visible at the top without the glass; glass card only after scrolling** (Ahmed in chat, 2026-10-10). Done.
- [x] 2026-10-10 · decision · Native scroll or the smooth-scroll library? → **Bring ScrollSmoother back + slow auto-snap to the next section when stopping between sections** (Ahmed in chat, 2026-10-10). Done.
- [x] 2026-10-10 · round 4 · Ahmed: (1) stall at every section start, (2) smoother scroll, (3) **remove the auto-snap completely, not needed** (Ahmed in chat, 2026-10-10). Done: snap removed, ScrollSmoother replaced (Handoff 9).
- [ ] 2026-10-10 · check · Things the agent can't test (needs your session / real devices):
  1. Signed in → landing → «ابدأ مجانًا» and «عندي حساب» → should open `/dashboard` directly
  2. Scroll on the laptop, judged on a production build (`pnpm build` then `pnpm start`), not `pnpm dev` (dev ships ~4.8 MB of unminified JS): smooth wheel (one notch glides ~0.7s), no stall at section starts, no snap. Server already running: `http://localhost:3456` (prod build)
  3. Phone: real device, load speed + native scroll
- [ ] 2026-10-10 · check · App pages signed in (unchanged from before): `/dashboard`, `/chat`, `/jobs`, `/applications`, `/files`, `/profile`, `/settings/keys`, dark/light, phone width. Plus: a toast still shows in the app (e.g. save on `/profile`): `Toaster` moved from the root layout to `(app)/layout.tsx`

## Handoff
**Done (2026-10-10, commits `8b34b93` `76f1e04` `9b56be2` `c1529ba`, then Ahmed's 8 fixes + rounds 2–4 below, uncommitted):**
1. Phases 1–4: theme/tokens, landing `src/app/(marketing)/`, `(app)` sidebar shell, `(auth)` stage, verification.
2. Bigger `cta` / `glass` buttons (default h-11, lg h-13, `icon-pill` 44px); `CtaIcon` size follows the button.
3. Header nav links sit on the header (no inner pill).
4. `src/proxy.ts`: signed-in user on `/sign-in` or `/sign-up` → redirect to `?next` or `/dashboard`. Session verified with InsForge first (a forged/stale cookie stays on the page, no loop; tested).
5. Fonts: h1 Thmanyah Serif Display, h2 Thmanyah Serif Text, rest Thmanyah Sans; IBM Plex fallback (`--font-plex`, weights 400–700; 300 dropped, unused).
6. Auth: «أو» separator without a background (`FieldSeparator` = line · text · line); Google / Microsoft logos on OAuth buttons.
7. Round 2 (Ahmed's 4 issues):
   1. Header always visible; glass pill is its own layer that fades in after 24px scroll (`header-shell.tsx`).
   2. Hero `ProgressiveBlur` (8 backdrop-filter layers) froze the first scroll ~160ms → one `backdrop-blur-md` layer with a gradient mask (`progressive-blur.tsx` deleted).
   3. Load: `motion` removed (BorderBeam = CSS keyframes, WatchDemo = CSS transitions, MotionProvider deleted). `Toaster` (sonner) only in `(app)`. Plex weight 300 dropped. Landing JS ~326 → ~223 KB gzip without GSAP (GSAP adds ~45 KB back in round 3); fonts 264 → 215 KB.
   4. Security heading static (pin / sticky removed).
8. Round 3 (Ahmed: bring smooth scroll back, add snap, fix section-start stall):
   1. `gsap` + `@gsap/react` back. `landing-motion.tsx`: ScrollSmoother only on `(hover: hover) and (pointer: fine)`; touch = native scroll (smoother on touch moves content from JS → jitter).
   2. Snap (`data-snap` on how / watch / features / security / faq / final CTA): 220ms after a wheel/touch scroll stops, if the next section's top is between the header line (96px) and 60% of the screen → glide there in 1.1s (`power2.inOut`). Not after keyboard, anchor links, or its own glide; any wheel/touch cancels it. Tested desktop + touch: stop-between snaps, mid-section stays, low boundary stays, keyboard stays, touch cancels.
   3. Section-start stall: reveals start 10% of the screen before the element enters (no blank band), 550ms, 16px rise, Web Animations (compositor). Hero beam + shiny text on their own layers; infinite CSS animations paused off-screen (`data-pause-offscreen` on hero + works-with). `ShineBorder` (Features hover) animates only on hover and is now a server component.
   4. Tilt back on GSAP scrub.
9. Round 4 (Ahmed: stall at every section start, smoother scroll, remove snap):
   1. Snap removed (code + `data-snap`).
   2. Cause of the stall = ScrollSmoother itself: it moves the page with `transform`, so Chrome can't pre-raster the next section. Prod build, wheel bursts, 3 runs: ScrollSmoother 9–19 frames > 25ms per run (watch / features / security starts); native scroll + wheel smoothing 0. Reveals not the cause (disabling them changed nothing).
   3. ScrollSmoother → `smoothWheel()` in `landing-motion.tsx`: catches `wheel`, moves the real page scroll with an exponential ease (`WHEEL_SMOOTH_MS = 190`; bigger = softer). Skips Ctrl (zoom), horizontal, locked page (open sheet), inner scrollables. Stops when anything else moves the page (keyboard, scrollbar, anchor). `#smooth-wrapper`/`#smooth-content` removed from the layout. Anchors = native `scroll-behavior: smooth` + `scroll-margin-top`.
   4. Tested: glide, anchors (header, sheet, `/#features` on load) land 96px under the header, PageDown, reverse mid-glide, clamp top/bottom, sheet open blocks page wheel, 47/47 reveals, touch + reduced motion = no smoothing, no console errors, `pnpm check` passes.
10. Verified: `pnpm check` passes; production build; screenshots 1440/390 dark/light; header + mobile-menu anchors land 96px under the header; all 47 `data-reveal` show; no console errors; no horizontal scroll.

**Remaining:**
1. Commit when Ahmed asks. `package.json` has another session's `seed:demo` lines → commit only the dependency lines (`motion` removed, `gsap` + `@gsap/react` added).
2. `AGENTS.md` tools row (once its other-session edits are committed): add `gsap` + `@gsap/react` and Magic UI / shadcn registry components (approved for the UI task, 2026-10-10). No `motion`.
3. After Ahmed's checks: fix what he reports, then delete this file.

**Need to know:**
1. `LandingMotion` must stay the last child of `page.tsx`, not in the layout: the layout's effects run before the page segment hydrates → editing the DOM early → hydration mismatch.
2. No ScrollSmoother anymore → `sticky`, `position: fixed`, CSS scroll-driven animations all work normally. Don't bring it back (round 4 numbers). Don't put `backdrop-filter` inside a `data-tilt` element (grey block).
3. Reveal: IO `rootMargin: 0px 0px 10% 0px`, stagger capped at 0.3s. Elements above the viewport on load (`/#faq`) show instantly; elements jumped past show when scrolled back to.
4. Perf findings (Playwright + Chrome trace on this laptop): main thread has zero tasks > 16ms while scrolling, dev and prod. Hitches were GPU-side (ScrollSmoother). The biggest one-off spikes are ANGLE shader compiles that a fresh headless profile repeats every run (real Chrome caches them). Measurements here are noisy (other sessions, Ahmed's Chrome share the GPU): repeat 3x and compare medians. Probe: Playwright wheel bursts (4 × 100px, 45ms apart, 380ms pause) at 1440×860 DPR 1.5, count rAF gaps > 25ms while moving. Run against `pnpm start` (launch config `web-prod`, port 3456).
5. Reduced motion: no wheel smoothing, no reveals, no tilt, no beam; `data-reveal` hidden state is CSS under `@media (scripting: enabled) and (prefers-reduced-motion: no-preference)`.
6. Perf traps: stacked `backdrop-filter` layers, JS-driven per-frame animations, infinite non-composited CSS animations (background-position, offset-distance) without their own layer. A data-reveal element shouldn't own a `transition` on opacity/translate.
7. Thmanyah: `@font-face` with `local()` in `globals.css`; files never copied into the repo (license).
8. Turbopack dev sometimes misses a `globals.css` edit; `touch` doesn't help, a real content change does.
9. Registry: shadcn `sidebar sheet tooltip accordion` (+ `use-mobile`); Magic UI `dot-pattern marquee border-beam animated-shiny-text animated-theme-toggler shine-border`. `dot-pattern` and `border-beam` are rewritten as pure CSS; `shine-border` has no default animation (caller adds `motion-safe:group-hover:animate-shine`).
10. Reduced motion in client components: `useSyncExternalStore` (server snapshot `false`). Marquee wrapper stays `dir="ltr"`. Responsive grids need `grid-cols-1` base.
11. Screenshots: `playwright-core` + `chromium.launch({ channel: "chrome" })` headless; light needs `localStorage.theme = "light"`. If another session's mid-edit work breaks `pnpm build` outside the landing, build a scratch copy with that folder reset to HEAD.
12. `(app)/layout.tsx` is also edited by the chat-ui session (`has-data-[slot=chat-shell]`); my only change there is the `Toaster` line.
13. Not touched (other sessions' uncommitted edits): `applications/[id]/page.tsx`, `submit-panel.tsx`, `applications/actions.ts`, `chat/**`, `AGENTS.md`.
