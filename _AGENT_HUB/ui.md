# ui — Landing page + UI refresh (black & white, RTL)

## Waiting on Ahmed
- [ ] 2026-10-10 · check · Open the app signed in and look at it (agent can't sign in: auth is hosted InsForge):
  1. `pnpm dev` → `http://localhost:3000`
  2. `/dashboard`, `/chat`, `/jobs`, `/applications` (+ one application), `/files`, `/profile`, `/settings/keys`
  3. Toggle dark/light (button in the sidebar), then a phone-width window (menu button top-left)
  4. Tell the agent anything that looks off

## Handoff
**Done (2026-10-10, commits `8b34b93` `76f1e04` `9b56be2` + phase 4):**
1. Phase 1: `next-themes` (dark default), IBM Plex Sans Arabic, tokens (`--stage`, `--hairline`, cta/glass/header vars in `globals.css`), `Button` `cta` / `glass` / `icon-pill` + `<CtaIcon />`, `ThemeToggle`.
2. Phase 2: landing in `src/app/(marketing)/` (header, hero + product mock, works with, how it works, `#watch` demo, features, security, FAQ, final CTA, footer). `/` static.
3. Phase 3: `(app)` sidebar shell (right side, inset, mobile sheet), `(auth)` card on a stage, `PageHeader` / `EmptyState` / `SegmentedNav`, `Card` restyle. Presentation only.
4. Phase 4: `pnpm check` + `pnpm build` pass. Screenshots 390/1440 dark/light of `/`, `/sign-in`, app shell. No horizontal scroll at 360. No console/hydration errors (fixed one under reduced motion). Stronger focus rings. Header OK at 768/1024.

**Remaining:**
1. Add one line to the `AGENTS.md` tools row once its uncommitted edits (other session) are committed: `motion` + Magic UI / shadcn registry components (approved for the UI task, 2026-10-10).
2. After Ahmed's check: fix what he reports, then delete this file.

**Need to know:**
1. Deps added: `motion` only. Registry items: shadcn `sidebar sheet tooltip accordion` (+ `use-mobile`); Magic UI `dot-pattern marquee border-beam blur-fade animated-shiny-text animated-theme-toggler progressive-blur shine-border`.
2. Skipped: Launch UI (viewed only), `navigation-menu`, `@lucide-animated/*`, `light-rays`, `bento-grid` (adds `@radix-ui/react-icons`), `safari` (fixed-ratio image/video frame → `browser-frame.tsx`), `animated-list` (empty card on mobile → `#watch` lists all steps and lights them up).
3. Rewrote vendored code: `dot-pattern` (CSS background, no JS), `use-mobile` (`useSyncExternalStore`), theme toggler (CSS icons, reduced motion, Arabic label), sheet/sidebar labels in Arabic.
4. Reduced motion inside client components: read it with `useSyncExternalStore` (server snapshot `false`). `motion`'s `useReducedMotion` causes a hydration mismatch.
5. Marquee wrapper must stay `dir="ltr"`. Responsive grids need `grid-cols-1` as base (else horizontal scroll on phones).
6. Dark is the default even on a light OS (brief). Light screenshots need `localStorage.theme = "light"`.
7. Screenshots: Chrome extension was not connected → `playwright-core` with `chromium.launch({ channel: "chrome" })` headless works.
8. `package.json` had another session's uncommitted `seed:demo` scripts → only the `motion` line was committed (index built from HEAD + that line).
9. Not touched (other sessions' uncommitted edits): `applications/[id]/page.tsx`, `submit-panel.tsx`, `applications/actions.ts`, `chat/_components/tool-parts.tsx`. They inherit the new `Card` / tokens.
