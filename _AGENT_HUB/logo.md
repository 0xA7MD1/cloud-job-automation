# logo — Site logo replacing the plain «مساعد التقديم» text

## Waiting on Ahmed
- [ ] 2026-10-10 · check · Signed-in pages (agent can't sign in):
  1. Sidebar top (desktop) and the mobile bar (phone width) on `/dashboard`: mark + name, dark and light
  2. Like the logo? If not: say what to change (mark only without the name, other shape, other weight)

## Handoff
**Done (uncommitted):**
1. `src/components/logo.tsx`: `LogoMark` (tile) + `Logo` (tile + name). Sized in `em` → text size class on the parent/`className` sets both.
2. Used in: marketing header, mobile menu title, footer, product-preview mock sidebar, auth layout, `(app)` sidebar, `(app)` mobile bar. Footer copyright + page `<title>` stay plain text.
3. `src/app/icon.svg` (favicon) redrawn; new `src/app/apple-icon.png` (180px, full-bleed, iOS rounds it).
4. Verified: typecheck + lint pass; screenshots 1280/390 dark/light (header, sign-in, mobile menu, footer, preview mock); no console errors.

**Remaining:**
1. After Ahmed's check: adjust, commit, delete this file.

**Need to know:**
1. Mark = Arabic «ت» (for تقديم) with diamond (calligraphic) dots; also reads as a smiling face. Tile reuses the `cta` tokens (`--cta-bg`, `--cta-fg`, `--cta-border`) → flips with the theme by itself.
2. Glyph paths are copied in 3 places: `logo.tsx`, `icon.svg`, `apple-icon.png` (rendered from the same paths with `playwright-core`, glyph scaled 0.8 on a square). Change one → redo the others.
3. Files edited here also carry the ui session's uncommitted work (`site-header.tsx`, `site-footer.tsx`, `product-preview.tsx`, `(app)/layout.tsx`) → my diff there is only the `Logo` import + the swapped element.
