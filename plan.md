# IronAI — Improvement Plan

> Living document. Add ideas freely. Claude reads this at session start to pick up where we left off.
> Last updated: 2026-03-03

---

## Status Key
- [ ] Not started
- [~] In progress
- [x] Done

---

## Design Changes

### D1. Typography Scale
- [x] Add `--font-2xs` through `--font-5xl` CSS variables to `index.css`
- [x] Audit top 4 component CSS files (WorkoutLogger, Coach, ExerciseCard, GoalSelectionGuard)
- [x] Replace hardcoded sizes with variables in key files
- [x] Build verified, no errors

### D2. Kill Inline Styles
- [x] `WorkoutLogger.tsx` — move inline styles to CSS
- [x] `GoalSelectionGuard.tsx` — move inline styles to CSS
- [x] `ExerciseCard.tsx` — move inline styles to CSS
- [x] Build verified, CSS consolidation complete

### D3. Loading / Empty / Error States
- [x] Create `Spinner` component (`src/components/Spinner.tsx` + `StateComponents.css`)
- [x] Create `EmptyState` component (`src/components/EmptyState.tsx`)
- [x] Add loading + empty states to History, Templates, Records pages
- [x] Remove stray `console.log` from History, bare `console.error` from Coach
- [x] Fix invalid CSS in `Records.css` (string-quoted values)
- [x] Kill all inline styles from Templates.tsx (moved to `Templates.css`)
- [x] Build verified, no errors

### D4. Z-Index Scale
- [x] Define `--z-nav` (40), `--z-timer` (50), `--z-modal` (100), `--z-toast` (110) in `index.css`
- [x] Applied to `WorkoutLogger.css` header and `Coach.css` header + toast
- [x] Foundation set for remaining modal/overlay components

### D5. Break Up GoalSelectionGuard
- [x] Create `WizardShell` layout component (`src/components/wizard/WizardShell.tsx`) — back button, title, subtitle, optional progress dots
- [x] Create `OptionCardGrid` component (`src/components/wizard/OptionCardGrid.tsx`) — reusable card picker (Goal, Experience, Equipment, Persona steps)
- [x] Refactored `GoalSelectionGuard.tsx`: 567 → 253 lines (55% reduction), zero duplication
- [x] Build verified, wizard confirmed working in preview

---

## Architecture / Code Changes

### A1. Decompose WorkoutLogger (God Component)
- [x] Extract `useWorkoutTimer()` hook → `src/hooks/useWorkoutTimer.ts` (26 lines)
- [x] Extract `usePostWorkoutReview()` hook → `src/hooks/usePostWorkoutReview.ts` (197 lines)
- [x] PR detection folded into `usePostWorkoutReview` (removed redundant `checkAndSavePRs` call)
- [x] Extract `PostWorkoutReviewModal` component → `src/components/PostWorkoutReviewModal.tsx` (100 lines)
- [x] `WorkoutLogger.tsx` reduced from 544 → 306 lines (44% smaller)

### A2. Centralize ID Generation
- [x] Create `src/lib/id.ts` with `generateId()` using `crypto.randomUUID()`
- [x] Find-and-replace all `Math.random().toString(36)` usages (26 replacements across 13 files)
- [x] Use new utility everywhere
- [x] Verified build passes with no errors

### A3. Move localStorage Data into Dexie
- [x] Add `chatMessages` table to Dexie schema (version 11: `id, timestamp`)
- [x] Add `restTimerPrefs` table to Dexie schema (version 12: `exerciseId` primary key)
- [x] Migrate coach chat history from localStorage to Dexie (`ironai_coach_history` → `db.chatMessages`)
- [x] Migrate rest timer preferences to Dexie (`ironai_rest_prefs` → `db.restTimerPrefs`)
- [x] One-time migration runs on mount in Coach.tsx and RestTimerContext.tsx; localStorage keys removed after import
- [x] Removed fragile `storage` event listener in Coach.tsx — cross-tab sync now automatic via `useLiveQuery`
- [x] Keep localStorage only for truly ephemeral session flags (active workout in-progress, AI config/keys)

### A4. Test Coverage
- [x] `scoringEngine.ts` — getVolumeLoad, getEstimated1RM, calculateWorkoutScore (22 tests, all goal weights, consistency, progression paths)
- [x] `WorkoutContext` — workout lifecycle: start → name → cancel → finish → persist/restore (13 tests)
- [x] `prService.ts` — PR detection: new, regression, improvement, tie, skips undone/warmup/drop sets (9 tests)
- [x] `exerciseResolver.ts` — expanded from 5 → 15 tests: case insensitivity, alias casing, cap at 5 candidates, empty DB, rawName passthrough
- [x] `database.ts` — schema presence (v11 chatMessages, v12 restTimerPrefs), CRUD, orderBy, upsert, bulkPut idempotency (11 tests)
- [x] **70 tests total, all passing** — 0 failures

### A5. Code Splitting / Lazy Loading
- [x] `React.lazy()` + `Suspense` for all 14 route-level pages in `App.tsx`
- [x] recharts auto-deferred (lives in History/ExerciseDetails which are now lazy)
- [x] Initial bundle: 1,167 kB → 563 kB (52% reduction)
- [ ] Lazy-load OpenAI SDK — deferred (requires restructuring provider pattern)

### A6. Anthropic + Gemini Providers
- [ ] Implement `AnthropicProvider` using `@anthropic-ai/sdk` (add to `useAIProvider` provider list)
- [ ] Implement `GeminiProvider` using `@google/generative-ai` SDK
- [ ] Update `AISettings.tsx` to show radio buttons for provider selection (OpenAI, Anthropic, Gemini)
- [ ] Add provider keys to localStorage + AISettings (similar to existing OpenAI)
- [ ] Ensure all coach prompts route through the selected provider
- [ ] Test each provider's message formatting and error handling
- [ ] Build verified, no TypeScript errors

### A7. Export / Import Workout Data
- [ ] Create export modal: JSON (full history) + CSV (simple spreadsheet)
- [ ] Add "Export" button to More page (or History page)
- [ ] Implement `downloadJSON()` — `db.workoutHistory.toArray()` → JSON file
- [ ] Implement `downloadCSV()` — workout array → CSV with columns: Date, Exercise, Sets, Reps, Weight, Notes
- [ ] Create import modal: accept JSON file, validate schema, merge-or-replace strategy
- [ ] Add "Import" button to More page
- [ ] Implement `importJSON()` — parse file, upsert to `db.workoutHistory` (skip duplicates by ID)
- [ ] Build verified, test export/import round-trip

### A8. Accessibility Audit & Improvements
- [ ] Audit ARIA labels: add `aria-label` / `aria-labelledby` to non-semantic buttons + icons
- [ ] Keyboard navigation: Tab order, focus styles (`outline: 2px solid var(--focus-ring)` or outline offset)
- [ ] Screen reader testing: test with NVDA (Windows) or VoiceOver (macOS)
- [ ] Form labels: ensure all `<input>` elements have associated `<label>` or `aria-label`
- [ ] Color contrast: verify all text meets WCAG AA (4.5:1 for normal, 3:1 for large)
- [ ] Modal focus trap: trap focus inside modal when open, restore focus on close
- [ ] Skip links: optional "Skip to main content" link above top nav
- [ ] Build verified, accessibility report added to plan.md

### A9. Advanced Analytics
- [ ] Create `AnalyticsPage.tsx` component (route: `/analytics`)
- [ ] Muscle group heatmap: aggregate volume by muscle, render as grid heatmap (darker = more volume)
- [ ] Volume trends: per-exercise line chart (X: date range, Y: total volume per session)
- [ ] Stats cards: total workouts, total volume, avg intensity, longest streak
- [ ] Filters: date range picker, muscle group selector, exercise name search
- [ ] Add "Analytics" nav link to bottom nav or More page
- [ ] Use recharts for all charts (already lazy-loaded)
- [ ] Build verified, preview analytics dashboard

---

## Ideas / Backlog

> Drop ideas here. We'll promote them to sections above when ready to tackle.

- Cloud sync / account auth (planned for future)
- Wearable integration (Apple Watch, Fitbit)
- Cloud backups / automatic sync

---

## Session Log

> Brief notes on what got done each session so Claude can orient quickly.

### 2026-03-03
- Initial codebase audit completed
- Identified top 5 design + top 5 architecture improvements
- Created this plan.md
- Dev servers configured in `.claude/launch.json` (vite-dev:5173, api-proxy:8080)

### 2026-03-03 (continued)
- **A2 Complete**: Centralized ID generation
  - Created `src/lib/id.ts` with `generateId()` using `crypto.randomUUID()`
  - Replaced 26 `Math.random().toString(36)` usages across 13 files
  - Build verified, no TypeScript errors
  - IDs are now properly unique (RFC4122 v4 UUIDs)

- **D1 + D4 Complete**: Design System Foundations
  - Added typography scale: `--font-2xs` (10px) through `--font-5xl` (36px)
  - Added z-index scale: `--z-base` (0), `--z-nav` (40), `--z-timer` (50), `--z-modal` (100), `--z-toast` (110)
  - Updated 4 major CSS files: WorkoutLogger, Coach, ExerciseCard, GoalSelectionGuard
  - ~30+ font-size hardcodes replaced with variables
  - Build verified, CSS slightly increased (typography inheritance working)

- **D2 Complete**: Kill Inline Styles
  - **ExerciseCard.tsx**: 8 inline styles → CSS classes (title cursor, footer flex, timer margins, load arrow colors)
  - **WorkoutLogger.tsx**: 20 inline styles → CSS classes (empty state, modal overlay, AI review sections with colored borders)
  - **GoalSelectionGuard.tsx**: 12 inline styles → CSS classes (feature icons, textarea, form spacing)
  - Total: ~40 inline `style={{}}` blocks removed, replaced with semantic CSS classes
  - Build verified, no errors. Bundle size stable.

- **A1 Complete**: Decompose WorkoutLogger
  - Created `src/hooks/useWorkoutTimer.ts` (26 lines) — timer state + interval
  - Created `src/hooks/usePostWorkoutReview.ts` (197 lines) — finish flow, AI review, template detection, PR query
  - Created `src/components/PostWorkoutReviewModal.tsx` (100 lines) — review modal UI
  - `WorkoutLogger.tsx` reduced from 544 → 306 lines (44% smaller)
  - Removed redundant `checkAndSavePRs` call (already done in WorkoutContext.finishWorkout())
  - `handleFinish` returns `Promise<boolean>` to signal whether review modal opened
  - Build verified, no TypeScript errors

### 2026-03-04
- **D3 Complete**: Loading / Empty / Error States
  - Created `src/components/Spinner.tsx` — animated spinner with sm/md/lg sizes + optional label
  - Created `src/components/EmptyState.tsx` — icon + title + description + optional action button
  - Created `src/components/StateComponents.css` — shared CSS using design system variables
  - `History.tsx`: added Spinner loading guard, replaced ad-hoc empty div with EmptyState, removed stray console.log + console.error
  - `Templates.tsx`: replaced all inline styles + plain-text loading/empty with Spinner/EmptyState, created `Templates.css`
  - `Records.tsx`: replaced inline loading/empty with Spinner/EmptyState, fixed broken CSS (string-quoted values in Records.css), added semantic classes
  - `Coach.tsx`: removed bare `console.error` (error already surfaces as chat bubble message)
  - Build verified, no TypeScript errors, all 3 pages confirmed in preview

### 2026-03-04 (continued)
- **A5 Complete**: Code Splitting / Lazy Loading
  - All 14 route-level pages converted to `React.lazy()` in `App.tsx`
  - `<Suspense fallback={<Spinner size="lg" />}>` wraps the route tree
  - Initial bundle: 1,167 kB → 563 kB (**52% reduction**)
  - recharts (345 kB) now deferred — only loads when History or ExerciseDetails visited
  - 14 page chunks emitted, each loading on first navigation to that route
  - Build verified, zero TypeScript errors, app confirmed working in preview

### 2026-03-04 (continued)
- **A3 Complete**: Move localStorage Data into Dexie
  - Added `ChatMessage` (v11) and `RestTimerPref` (v12) tables to `database.ts`
  - `Coach.tsx`: Replaced `useState<Message[]>` + localStorage with `useLiveQuery(() => db.chatMessages.orderBy('timestamp').toArray())`
  - `Coach.tsx`: Added one-time migration on mount — imports old `ironai_coach_history` into Dexie, removes localStorage key
  - `Coach.tsx`: Removed fragile `storage` event listener (cross-tab sync now automatic via useLiveQuery)
  - `Coach.tsx`: All `setMessages(...)` calls replaced with `db.chatMessages.add({...})`; clear → `db.chatMessages.clear()`
  - `usePostWorkoutReview.ts`: Post-workout audit now writes to `db.chatMessages` directly (no localStorage round-trip)
  - `RestTimerContext.tsx`: `startTimer` now async-loads pref from Dexie; `adjustDuration` fire-and-forget puts to Dexie; one-time migration of `ironai_rest_prefs`
  - Build verified, zero TypeScript errors

### 2026-03-04 (continued)
- **A4 Complete**: Test Coverage — 70 tests, 0 failures
  - Installed: `fake-indexeddb`, `jsdom`, `@testing-library/react`
  - Created `vitest.config.ts` (jsdom env) + `src/test/setup.ts` (`fake-indexeddb/auto` polyfill)
  - Added `"test": "vitest"` and `"test:run": "vitest run"` scripts to package.json
  - `scoringEngine.test.ts` — 22 tests: pure helpers + calculateWorkoutScore with all goal types, consistency, progression
  - `prService.test.ts` — 9 tests: new PR, regression, improvement, tie, skips undone/warmup/drop sets
  - `exerciseResolver.test.ts` — expanded 5 → 15 tests: case insensitivity, aliases, ambiguous base names, empty DB, candidate capping
  - `WorkoutContext.test.tsx` — 13 tests: lifecycle, localStorage persist/restore, finishWorkout saves to Dexie
  - `database.test.ts` — 11 tests: v11 chatMessages, v12 restTimerPrefs schema + full CRUD, orderBy, upsert behavior

### 2026-03-04 (continued)
- **PWA Complete**: Install-to-Homescreen Support
  - Installed `vite-plugin-pwa` + `@vite-pwa/assets-generator`
  - Created `public/logo.svg` — mint-green squircle with white dumbbell icon
  - Generated 6 icon files via `npx pwa-assets-generator` (minimal2023Preset): favicon.ico, pwa-64x64.png, pwa-192x192.png, pwa-512x512.png, maskable-icon-512x512.png, apple-touch-icon-180x180.png
  - `vite.config.ts`: VitePWA plugin with full manifest + Workbox config (precache 71 entries, navigateFallback, Google Fonts runtime caching)
  - `index.html`: PWA meta tags (theme-color, apple-mobile-web-app-capable, apple-touch-icon, manifest link)
  - Created `src/components/InstallBanner.tsx` — Chrome `beforeinstallprompt` flow + iOS "Tap Share → Add to Home Screen" instructions, 7-day dismiss TTL, hides when already standalone
  - Created `src/components/InstallBanner.css` — fixed above bottom nav, slide-up animation
  - Wired `<InstallBanner />` into `App.tsx` (outside router, inside ErrorBoundary)
  - Build verified: `dist/sw.js` + `dist/manifest.webmanifest` emitted, zero TS errors

### 2026-03-04 (continued)
- **Post-Workout Review v2 Complete** — Rich review card in Coach chat
  - New `PostWorkoutReview` type: reviewSummary, wins, issues (with cause+fix), prHighlights, weekProgress, goalProgress, takeawaysTTL, takeawaysDurableCandidates
  - DB v13: `chatMessages` gains `type`, `reviewStatus`, `reviewData`, `reviewWorkoutId` (indexed); new `takeaways` table
  - `reviewOrchestrator.ts` — standalone async pipeline: fetches workout, template, history, PRs, week plan → calls AI → saves TTL takeaways → updates chatMessage
  - `openaiAdapter.ts` — new rich prompt: plan adherence vs template, per-exercise trend (3 prev sessions), week progress, structured issues format
  - `usePostWorkoutReview.ts` — simplified to 100 lines: creates pending chatMessage, fires orchestrator, returns `true` → navigate to /coach
  - `WorkoutLogger.tsx` — always navigates to `/coach` if sendToCoach=true (no more modal blocking); PostWorkoutReviewModal removed from render
  - `ReviewCard.tsx` — 3 states: pending (pulsing dots), error (retry button), complete (full card with all sections)
  - `ReviewCard.css` — scannable card: score, summary bullets, PRs (gold), wins (green), issues (amber), week bar, goal progress, durable takeaway chips (Save/Dismiss)
  - `Coach.tsx` — renders ReviewCard for `type === 'review'` messages, retry handler, filters review messages from API chat history
  - Idempotency: `reviewWorkoutId` index prevents duplicate reviews per workout
  - Build verified: zero TS errors, 74 precached entries

### 2026-03-04 (continued)
- **D5 Complete**: Break Up GoalSelectionGuard
  - Created `src/components/wizard/WizardShell.tsx` — shared back button + header + optional progress dots
  - Created `src/components/wizard/OptionCardGrid.tsx` — reusable card picker grid (eliminates 4× duplication of goal-card pattern)
  - `GoalSelectionGuard.tsx` reduced from 567 → 253 lines (55% reduction)
  - Fixed TS2322 type errors on `experienceLevel` / `coachPersona` (undefined → null coercion with `?? null`)
  - Build verified, zero TypeScript errors, wizard flow confirmed in preview
