# ui — Landing page + UI refresh (black & white, RTL)

## Waiting on Ahmed
- (none)

## Handoff
**Done:**
1. Phase 1 (2026-10-10): `next-themes` mounted (dark default), IBM Plex Sans Arabic, tokens (`--stage`, `--hairline`, cta/glass vars), `Button` variants `cta` / `glass` + size `icon-pill` + `<CtaIcon />`, `ThemeToggle` (`src/components/theme-toggle.tsx`). Toasts monochrome (no `richColors`; error icon red).
2. Installed: shadcn `sidebar sheet tooltip accordion` (+ `src/hooks/use-mobile.ts`), Magic UI `dot-pattern marquee border-beam blur-fade animated-list animated-shiny-text animated-theme-toggler progressive-blur shine-border`. New dep: `motion`.

**Remaining:** phases 2 → 4. After each: `pnpm check`, `pnpm build`, screenshots, update this section.

**Need to know:**
1. `package.json` has another session's uncommitted `seed:demo` scripts → commit only the `motion` line (stage a HEAD copy + that line with `git update-index --cacheinfo`, then `git commit` without paths).
2. `AGENTS.md` has another session's uncommitted edits → the tools-row line for `motion` + Magic UI is NOT added yet. Add it once their edits are committed.
3. Rewrote vendored code: `dot-pattern` (CSS background, no JS, server-rendered), `use-mobile` (`useSyncExternalStore`, lint rule), theme toggler (icons from `html.dark` CSS, reduced motion, Arabic label).
4. `pnpm build` works while `pnpm dev` runs (dev writes to `.next/dev`).
5. Skipped: Launch UI (viewed only), `navigation-menu`, `@lucide-animated/*`, `light-rays`, `bento-grid` (adds `@radix-ui/react-icons`).

---

## Brief

### 1. Goal
Rebuild the landing page (`/`) and refresh the app UI. Strict black & white. Open the references before designing:
1. https://www.sndr.sh — closest overall: framed hero "stage" with a dot grid, gradient headline, product mockup under the hero, "watch it work" section, final CTA stage.
2. https://cranl.com — big type on a quiet black page, 3-step "how it works", "You stay in control" trust grid.
3. https://bandar.solutions/ar — floating glass pill header and its buttons (spec in §4). Ignore its purple.

### 2. Rules
1. Monochrome: existing `neutral` tokens only. The only hue allowed is `--destructive` for errors. Dark `--sidebar-primary` is blue today → make it neutral.
2. Arabic RTL stays (`dir="rtl"`, `lang="ar"`). Logical utilities only (`ms/me/ps/pe/start/end/text-start`). Directional icons point the RTL way.
3. Arabic type: no `tracking-*` on Arabic text (breaks letter joining). Display leading 1.15–1.25, not the Latin 1.0. Gradient text gets `pb-[0.15em]` so descenders don't clip.
4. Copy: Saudi dialect, short, same voice as the current `src/app/page.tsx` (reuse its CTA labels). Claim only what the code and AGENTS.md support. No invented stats, testimonials, customer logos or prices. Mockups use fictional companies and people.
5. Stack is locked (AGENTS.md). Approved for this task only: `motion` + component code copied in by the shadcn CLI from §3. Add one line about them to the AGENTS.md tools row (if another session has uncommitted edits in AGENTS.md, note it in Handoff instead).
6. Next.js 16 differs from your training data: read the matching guide in `node_modules/next/dist/docs/` before coding. `cacheComponents` is on → `cookies()` / `params` / `searchParams` / `usePathname()` only inside `<Suspense>`. Keep `/` fully static (no session read).
7. Parallel sessions edit `src/app/(app)/applications/**`, `src/app/(app)/chat/_components/**`, `src/lib/**`. Run `git status` and read `_AGENT_HUB/*.md` first. Never edit a file that has someone else's uncommitted changes. Commit only your own paths: `git commit -- <paths>`.
8. Server Components by default; client components only for interactive parts. Honour `prefers-reduced-motion`. WCAG AA contrast in both themes, visible focus rings, no horizontal scroll at 360px, no layout shift.

### 3. Component sources
`components.json` has `"rtl": true` → the CLI rewrites classes to logical/RTL on install, third-party registries included (verified on `@magicui/interactive-hover-button`). All namespaces below are built into the CLI; no `components.json` change needed.

Per item:
1. `pnpm exec shadcn view <item>` (read the code)
2. `pnpm exec shadcn add <item> --dry-run`
3. Add only if it creates new files and overwrites nothing. Never use `--overwrite`.
4. Review `git diff`.
5. Add everything that pulls shadcn `button` (e.g. `@magicui/bento-grid`) **before** customising `button.tsx`; later adds would try to replace it.

| Source | Use for | Items |
|---|---|---|
| Magic UI `@magicui` (free, MIT) | effects, motion, mockups | `dot-pattern` `marquee` `border-beam` `blur-fade` `animated-list` `safari` `animated-shiny-text` `animated-theme-toggler` `progressive-blur`; optional `shine-border` `light-rays` |
| Launch UI `@launchui` (free, MIT) | whole landing sections to copy | `navbar` `hero` `logos` `faq` `cta` `footer`: `view` and rebuild with our tokens. Don't install (ships its own `button.tsx`) |
| shadcn | base parts | `accordion` `sheet` `navigation-menu` `sidebar` `tooltip` |
| `@lucide-animated` (optional) | animated icons | `arrow-up-left` `moon` `sun` |

Skip: Tailark (registry returns 401 without a paid key), React Bits (some parts pull GSAP / Three.js), Aceternity (only if one hero effect is clearly better).

### 4. Buttons — must match the bandar.solutions header buttons
Extend `buttonVariants` in `src/components/ui/button.tsx`; keep existing variants. Colours as CSS vars in `globals.css` (`:root` + `.dark`).

**`variant="cta"` — pill + icon circle** (bandar `.primary-button`, made monochrome):
- `rounded-full inline-flex items-center gap-3 font-semibold`. Sizes: lg `h-11 px-5 text-sm` · default `h-10 px-4 text-sm` · sm `h-9 px-3 text-xs`.
- Background: gloss layer `linear-gradient(rgb(255 255 255 / .22), transparent 42%)` over a 135° gradient:
  - dark theme: `#fff → #e5e5e5 (42%) → #a3a3a3`, text `#0a0a0a`
  - light theme: `#404040 → #171717 (42%) → #000`, text `#fff`
- Border 1px: `rgb(255 255 255 / .22)` dark · `rgb(0 0 0 / .10)` light.
- `::before` sheen: `inset: 1px`, `rounded-[inherit]`, `linear-gradient(rgb(255 255 255 / .08), transparent 58%)`, `pointer-events-none`.
- Shadow: `0 18px 45px <glow>, inset 0 1px rgb(255 255 255 / .35)`. Glow: white/10 dark · black/20 light.
- Hover: `-translate-y-0.5` + stronger glow. Active: `translate-y-0` + smaller glow. Focus-visible: 3px neutral ring + glow. Transition `transform, box-shadow, filter` 220ms.
- Icon circle: `<span data-slot="cta-icon">`, `size-7 grid place-items-center rounded-full`, inverted colours (black circle + white icon on the white pill, and the reverse). Icon `ArrowUpLeft` `size-4` (RTL mirror of bandar's `ArrowUpRight`); nudges toward its corner on hover. Sits at the inline end (left in RTL).

**`variant="glass"` — secondary pill** (bandar's language button):
- `rounded-full border border-border bg-(--glass) shadow-(--card-shadow) h-11 px-4 gap-2`. Hover: `-translate-y-0.5 border-(--border-strong) bg-(--glass-hover)`. Leading icon `group-hover:rotate-12`. Bigger hit area: `before:absolute before:-inset-1.5`.
- Vars (dark · light): `--glass` white/5.5 · white/85 — `--glass-hover` white/9 · black/4 — `--border-strong` white/22 · black/16 — `--card-shadow` `0 22px 64px rgb(0 0 0 / .22), inset 0 1px 0 rgb(255 255 255 / .10)` · `0 16px 48px rgb(0 0 0 / .06), inset 0 1px 0 #fff`.

**`size="icon-pill"`** — 40px circle with `glass` styles, `active:scale-95` (theme toggle, mobile menu).

Use `cta` / `glass` / `icon-pill` on the landing, headers, auth forms and each page's main action. Dense app controls keep the existing variants.

### 5. Phase 1 — foundation
1. Mount `next-themes` (installed, unused): `ThemeProvider` in `src/app/layout.tsx` with `attribute="class"`, `defaultTheme="dark"`, `enableSystem`, `disableTransitionOnChange`; `suppressHydrationWarning` on `<html>`. Dark is the default (all three references are dark); light must look equally finished.
2. Theme toggle: `@magicui/animated-theme-toggler` (copy from `animated-theme-toggler-next-themes-demo`), styled as `icon-pill`.
3. Font: IBM Plex Sans Arabic 300–700 via `next/font/google` as `--font-sans` for all text (bandar and sndr use it; it includes Latin). Keep Geist Mono. Don't touch `assets/fonts/` (PDF font).
4. Tokens: add `--stage` (dark `#111`–`#171717` · light `neutral-50`) and hairline borders (white/7–10 dark · black/6–8 light). Page background stays near-black / white.
5. Buttons from §4.

### 6. Phase 2 — landing `/`
Move to `src/app/(marketing)/page.tsx` + `layout.tsx` (header, footer); sections in `src/app/(marketing)/_components/`. Delete the old `src/app/page.tsx`. Sections in order:
1. **Header** (bandar): fixed floating pill, `top-4`, `h-16`, `w-[min(1200px,calc(100%-32px))]`, centred, `rounded-full border`, glass gradient bg + `backdrop-blur-xl` + soft deep shadow, 1px highlight line along the top edge. Start: product name. Centre: anchor links (features, how it works, security, FAQ) in an inner pill; active = filled pill. End: theme `icon-pill`, sign-in `glass`, sign-up `cta`. Mobile: `cta` + menu `icon-pill` → shadcn `sheet`.
2. **Hero stage** (sndr): wrapper `px-2 pt-2 sm:px-3 sm:pt-3`; stage `rounded-[28px] border bg-(--stage) overflow-hidden` with `dot-pattern` masked to fade downward. Centred, top to bottom:
   - badge pill: pulsing dot + `animated-shiny-text`, links to `#watch`
   - H1: gradient text (foreground → foreground/55, top-down), `text-4xl sm:text-6xl lg:text-7xl font-semibold max-w-[16ch] text-balance`
   - muted subline `max-w-xl`, then `cta` + `glass`
   - product preview: JSX mock of the real flow (chat message → company/jobs card → prepare → application card with status badge) inside `safari`, `border-beam` on the frame, bottom cropped with `progressive-blur`. Build it from our real components and labels, not a screenshot.
3. **Works with**: `marquee` with faded edges; monochrome marks of real integrations: Greenhouse, Lever, Ashby · Groq, OpenRouter, OpenAI, Anthropic, Google · Exa, Tavily · Steel. Label it "works with", never "trusted by". Pause on hover.
4. **How it works** (cranl): 3 numbered cards: set up (AI key + CV) → ask in chat (companies + official job pages; results saved with source and date) → review and approve (answers + cover letter PDF/Word; it submits and saves proof).
5. **Watch it apply** `#watch` (sndr "Send an email. Watch where it goes."): split layout. One side: `animated-list` timeline of the real run steps, labels from `STEP_LABELS` in `src/lib/apply/labels.ts` (open → fill → upload → review → submit → confirm → evidence) with one `needs_user` beat (a code is needed → finish it in the live view). Other side: browser mock of a form filling in. Slow loop; static under reduced motion.
6. **Features** `#features`: 6-card bento, hairline borders, monochrome hover glow (`shine-border`): official sources only · your key, your provider (BYOK) · CV + cover letter (PDF / Word) · search memory (source + date on every result) · live view + take over · success = saved proof.
7. **You stay in control** `#security` (cranl): short items: nothing is sent without your confirmation · no automatic resubmits · keys encrypted (AES-256-GCM), never shown to the model or logs · live view is yours only · files in private storage with expiring links.
8. **FAQ** `#faq` (`accordion`): 5–6 questions answered only from AGENTS.md: what I need · does it send without me · cost (provider usage is billed to the user's own provider account; for app pricing keep what the current page says, otherwise ask Ahmed) · captcha / email codes · my data.
9. **Final CTA**: stage with a big headline + `cta`, dot pattern.
10. **Footer**: name + one line, section links, sign in / sign up, year. No social links unless Ahmed gives them.

Motion: `blur-fade` on section entry (once, small offset, staggered). Only the marquee and `#watch` loop.

### 7. Phase 3 — app + auth
1. `(app)` shell: shadcn `sidebar` like sndr's dashboard, on the start side (right). Groups: work = dashboard, chat, jobs, applications · account = files, profile, keys (labels from `nav-links.tsx`). Mobile: `sheet`. Sidebar RTL is manual: read `pnpm exec shadcn docs sidebar`. Keep the Suspense split (`NavLinksView` / `UserMenu`).
2. `(auth)`: centred card on a stage + dot pattern, product name on top, submit = full-width `cta`.
3. Pages: same tokens; cards `rounded-2xl border bg-card/50`; page header = title + one line + main `cta`; empty states = icon + one line + action. Presentation only: no data or logic changes.

### 8. Phase 4 — verify (also after every phase)
1. `pnpm check`, then `pnpm build` (stop `pnpm dev` first).
2. `pnpm dev`; open `/`, `/sign-in`, `/dashboard`, `/chat`. Screenshots at 390px and 1440px, dark and light.
3. Check: RTL arrows, no horizontal scroll, focus rings, reduced motion, no hydration or console errors, contrast.
4. Compare with sndr.sh (hero/stage) and the bandar header; fix spacing until it matches.
5. Report to Ahmed: screenshots, added deps + registry items, anything skipped.
