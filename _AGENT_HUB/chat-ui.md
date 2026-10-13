# chat-ui — Rework /chat layout, composer, and helpers

## Waiting on Ahmed

## Handoff
**Done:** nothing yet (started 2026-10-10).

**Remaining:**
1. Full-height chat shell (no max-w-5xl gaps): history panel on the start edge, top bar, inner scroll.
2. Composer redesign; centered composer on the empty state.
3. Helpers: scroll-to-bottom, smart auto-scroll, copy, regenerate, Esc to stop, missing-key notice, mobile history sheet, rename/delete chat.
4. Server: retry/regenerate drops stale replies; `[id]` page loads the latest 200 messages.

**Need to know:**
1. `tool-parts.tsx` has uncommitted edits from the apply-test session (`addJobFromUrl`, `JobRow`). Keep them.
