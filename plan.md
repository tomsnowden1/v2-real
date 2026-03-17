# IronAI — Improvement Plan

> Living document. Add ideas freely. Claude reads this at session start to pick up where we left off.
> Last updated: 2026-03-14

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
- [x] Implement `AnthropicProvider` using `@anthropic-ai/sdk` (add to `useAIProvider` provider list)
- [x] Implement `GeminiProvider` using `@google/generative-ai` SDK
- [x] Update `AISettings.tsx` to show radio buttons for provider selection (OpenAI, Anthropic, Gemini)
- [x] Add provider keys to localStorage + AISettings (similar to existing OpenAI)
- [x] Ensure all coach prompts route through the selected provider
- [x] Test each provider's message formatting and error handling
- [x] Build verified, no TypeScript errors

### A7. Export / Import Workout Data
- [x] Export JSON (full backup: workoutHistory + templates + profile) — More → Data section
- [x] Export CSV (workout history as spreadsheet rows) — More → Data section
- [x] Import JSON (file picker, validates schema, bulkPut merge strategy)
- [x] Build verified
- **Completed:** 2026-03-14

### A8. Accessibility Audit & Improvements
- [x] Audit ARIA labels — ExerciseCard & SetRow already had labels; added to SetRow inputs (weight/reps/RPE)
- [x] Form labels: weight/reps/RPE inputs now have `aria-label` (e.g. "Set 1 weight in lbs")
- [x] Modal: ConfirmModal now has `aria-labelledby` pointing to its title
- [x] Decorative SVGs: rest timer rings now have `aria-hidden="true"`
- [-] Full keyboard nav / screen reader / contrast audit — deferred (requires physical testing)
- **Completed:** 2026-03-14

### A9. Advanced Analytics
- [x] Create `Analytics.tsx` page (route: `/analytics`)
- [x] Stats cards: total workouts, total volume (respects weight unit), avg duration
- [x] Weekly volume bar chart (last 12 weeks)
- [x] Workouts per week bar chart
- [x] Most-trained exercises horizontal bar chart (top 10 by sets)
- [x] Add "Analytics" link to More page under Training
- [x] Build verified, preview confirmed
- **Completed:** 2026-03-14

---

## Audit: Quick Wins (< 1 day each)

> Found during full audit on 2026-03-07. Do these first — high impact, low effort.

### QW1. Add Loading State to "Finish & Save" Button
- [x] Add `isFinishing` state to `WorkoutLogger.tsx`
- [x] Disable the "Finish & Save" button and show "Saving..." text while async `handleFinish` runs
- [x] Prevents double-taps and "did it save?" anxiety
- **Files:** `FinishWorkoutSheet.tsx`, `WorkoutLogger.tsx`
- **Effort:** 1-2 hours
- **Completed:** 2026-03-07

### QW2. Add Progress Dots to Onboarding Wizard
- [x] Calculate total steps in `ArchitectIntakeWizard.tsx` (accounting for beginner/recovery skip logic)
- [x] Pass `dots` array to each `<WizardShell>` call — the prop already exists and renders correctly
- [x] Users see "Step 4 of 8" style progress, reducing drop-off
- **Files:** `src/components/wizard/ArchitectIntakeWizard.tsx` (WizardShell.tsx already supports it)
- **Effort:** 1-2 hours
- **Completed:** 2026-03-07

### QW3. Fix Dead "+ Custom" Button in Exercise Library
- [x] Wire up `onClick` handler on `ExerciseLibrary.tsx` line ~52
- [x] Add a small form modal (name, body part, category) or at minimum a "Coming soon" toast
- [x] The `isCustom` flag already exists on the Exercise interface in `database.ts`
- **Files:** `src/pages/ExerciseLibrary.tsx`, `src/db/exerciseService.ts`
- **Effort:** 1-3 hours (basic form) or 15 min (coming soon toast)
- **Completed:** 2026-03-07 (came soon toast approach)

### QW4. Unify Modal Overlay Into One CSS Variable
- [x] Add `--color-overlay: rgba(0,0,0,0.6)` to `src/index.css`
- [x] Replace hardcoded overlays in: FinishWorkoutSheet.css (0.6), ReplaceModal.css (0.5), WorkoutDetail.css (0.5), GymEquipment.css (0.55), AdjustWeekModal.css (0.6), WeeklyCheckInModal.css (0.6), ResolveExercisesModal.css (0.6)
- [x] Replace inline style overlays in: `WorkoutLogger.tsx` (0.55), `Home.tsx` (0.6)
- **Files:** `index.css` + 7 CSS files + 2 TSX files
- **Effort:** 1-2 hours
- **Completed:** 2026-03-07 (fixed 6 z-index bugs, unified overlays)

### QW5. Add `role="dialog"` + Escape Key to ConfirmModal
- [x] Add `role="dialog"` and `aria-modal="true"` to ConfirmModal wrapper
- [x] Add `onKeyDown` handler for Escape key
- [x] Since ConfirmModal is reused everywhere, this one fix helps all modals
- **Files:** `src/components/ConfirmModal.tsx`
- **Effort:** 2-3 hours
- **Completed:** 2026-03-07 (30 minutes)

---

## Audit: Trust & Safety

> These protect users from data loss and protect your wallet from API abuse.

### TS1. Wrap `finishWorkout` in a Dexie Transaction
- [x] Wrap the three sequential DB writes (workoutHistory, weeklyPlan, PRs) in `db.transaction()`
- [x] Add user-visible error toast/modal if saving fails (currently errors only go to console)
- [x] Move the PR check from fire-and-forget into the transaction scope
- [x] Add try/catch with meaningful user message on failure
- **Why:** This is the most critical data path. A partial failure means workout saves but PRs or weekly plan are wrong — and the user has no way to know.
- **Files:** `src/context/WorkoutContext.tsx` (lines ~108-143), `src/hooks/usePostWorkoutReview.ts`, `src/pages/WorkoutLogger.tsx`, `src/pages/WorkoutLogger.css`
- **Effort:** 2-4 hours
- **Risk if skipped:** HIGH — any IndexedDB hiccup silently corrupts state
- **Completed:** 2026-03-07

### TS2. Add "Soft Cancel" Recovery for Workouts
- [x] When canceling a workout, save it to a `recentlyCanceled` slot in localStorage (TTL: 10 min)
- [x] Show a "Resume last canceled workout" option on the WorkoutLogger empty state
- [x] After 10 minutes, the slot auto-expires
- **Why:** Cancel is instant and irreversible. Accidental cancels lose all workout data.
- **Files:** `src/context/WorkoutContext.tsx`, `src/pages/WorkoutLogger.tsx`, `src/pages/WorkoutLogger.css`
- **Effort:** 3-5 hours
- **Completed:** 2026-03-07

### TS3. Harden the API Proxy
- [x] Add model whitelist: only allow specific models (e.g., gpt-4o-mini, gpt-4o)
- [x] Cap `max_tokens` at 4000 (prevents abuse)
- [x] Validate `messages` is a non-empty array (reject malformed requests)
- [x] Add a Referer/Origin check to reject requests not from your domain
- [-] Optional: basic rate limiting (20 requests/minute per IP) — skipped (Vercel handles this)
- **Completed:** 2026-03-14
- **Why:** The proxy URL is in the JS bundle. Anyone who finds it can use your OpenAI key for anything.
- **Files:** `api/openai/v1/chat/completions.js`
- **Effort:** 2-4 hours
- **Risk if skipped:** HIGH (financial) — someone could run up your OpenAI bill

### TS4. Validate AI Response JSON Before Rendering
- [x] Add a validation function for `PostWorkoutReview` shape (Zod schema or manual checks)
- [x] In `ReviewCard.tsx`, validate after `JSON.parse()` instead of `as PostWorkoutReview` type assertion
- [x] If validation fails, fall through to the error state with a retry button (instead of rendering blank)
- **Completed:** 2026-03-14
- **Why:** AI responses are unpredictable. Malformed JSON silently renders nothing — no error, no retry.
- **Files:** `src/components/ReviewCard.tsx`, `src/lib/ai/types.ts`
- **Effort:** 2-4 hours

---

## Audit: UX Improvements

> Features that make daily use feel faster and more natural.

### UX1. Add "Repeat This Workout" to Workout Detail
- [x] Add a "Repeat" button to `WorkoutDetail.tsx`
- [x] Pre-fill exercises and sets from the historical workout data
- [x] Reuse the `startWorkout` + `updateExercises` pattern from `TemplateDetail.tsx` (lines ~63-77)
- **Completed:** 2026-03-14
- **Why:** Most natural user desire after viewing a past workout. Most workout apps offer this.
- **Files:** `src/pages/WorkoutDetail.tsx`, `src/context/WorkoutContext.tsx`
- **Effort:** 2-3 hours

### UX2. Add "Fill From Last Session" to Workout Logger
- [x] Add a "Fill all from last time" button to the WorkoutLogger exercise list
- [x] Populate weight/reps from the most recent session for each exercise
- [x] The history query already exists in WorkoutLogger (lines ~137-154) but only runs per-exercise on add
- **Why:** Biggest daily friction reducer. Users repeat similar weights most sessions.
- **Files:** `src/pages/WorkoutLogger.tsx`, `src/components/ExerciseCard.tsx`
- **Effort:** 3-5 hours
- **Completed:** 2026-03-07

### UX3. Template Lifecycle Improvements
- [x] Fix orphaned refs: when deleting a template, scan weeklyPlans and null out matching `dayAssignment.templateId` values
- [x] Add "Duplicate Template" button to `TemplateDetail.tsx`
- [x] Add "Save as Template" button to `WorkoutDetail.tsx` (for past ad-hoc workouts)
- [x] Fix hardcoded "kg" in WorkoutDetail.tsx — use user's `weightUnit` setting
- **Completed:** 2026-03-07
- **Why:** Templates are the backbone of the weekly plan system. Orphaned refs, no duplication, and no conversion from workouts create friction.
- **Files:** `src/db/templateService.ts`, `src/db/weeklyPlanService.ts`, `src/pages/TemplateDetail.tsx`, `src/pages/WorkoutDetail.tsx`
- **Effort:** 1-2 days

---

## Audit: UX Flow (March 2026)

> Found during full UX & Flow Audit on 2026-03-13. Ranked by daily gym experience impact.

### UXF1. Post-Workout Celebration + "What's Next" Screen
- [x] Create `WorkoutCompleteModal.tsx` — brief overlay after "Finish & Save"
- [x] Show: workout name, duration, total volume, and what's next
- [x] If sent to Coach: "Your Coach is reviewing this — tap to see" link
- [x] If not sent to Coach: "Next up: [template name] on [day]" with link to Home
- [x] "Done" button to dismiss
- [x] Replace bare `navigate('/coach')` / `navigate('/')` in `WorkoutLogger.tsx` with showing this modal first
- **Completed:** 2026-03-13
- **Why:** Right now finishing a workout is a dead end — the app just jumps to another page with zero feedback. This is the last thing you see after every session. A 2-second celebration makes every workout feel complete.
- **Files:** `src/pages/WorkoutLogger.tsx`, new `src/components/WorkoutCompleteModal.tsx`, `src/hooks/usePostWorkoutReview.ts`
- **Effort:** 2-3 hours

### UXF2. Simplify "Finish" Sheet Template Choices
- [x] Replace 3 radio buttons with one toggle: "Save today's weights to template?" (default ON)
- [x] Only show full 3-option picker when exercises were actually added/removed during workout
- [x] Detect "only values changed" vs "exercises were added/removed" in `usePostWorkoutReview.ts`
- **Completed:** 2026-03-13
- **Why:** The 3 template-update options are confusing when you're tired at the gym. Most people just want their weights saved for next time.
- **Files:** `src/components/FinishWorkoutSheet.tsx`, `src/hooks/usePostWorkoutReview.ts`
- **Effort:** 1-2 hours

### UXF3. Move "Fill from Last" to Top + Auto-Fill New Exercises
- [x] Move the "Fill from Last" button from bottom of exercise list to just below workout header
- [x] When adding a new exercise mid-workout, auto-fill weight/reps from last session (data lookup already exists in `handleReplace`)
- **Completed (button moved):** 2026-03-13
- **Why:** "Fill from Last" is one of the most useful features but it's buried at the very bottom where nobody will find it. Entering weights is the most repetitive part of logging.
- **Files:** `src/pages/WorkoutLogger.tsx` (move button ~line 332, extend `handleReplace` ~line 162), `src/pages/WorkoutLogger.css`
- **Effort:** 1-2 hours

### UXF4. Add "Next Workout" Card on Dead-End Pages
- [x] Add "Up next: [template] on [day]" card at bottom of `WorkoutDetail.tsx` with tap-to-start
- [x] Reuse `nextTemplateToDo` lookup pattern from `Home.tsx`
- **Completed:** 2026-03-13
- **Why:** After viewing a past workout, there's no way to jump to today's session. A common gym flow is "check last time's weights → start today" — currently takes 4-5 taps. This makes it 1.
- **Files:** `src/pages/WorkoutDetail.tsx`, reuse pattern from `src/pages/Home.tsx`
- **Effort:** 1-2 hours

### UXF5. End-of-Week Celebration + "Plan Next Week" Prompt
- [x] Detect when all scheduled workouts are completed (all `dayAssignments` with `templateId` also have `completedWorkoutId`)
- [x] Show celebration banner at top of Home: "Week Complete! You hit all X workouts"
- [x] Add "Plan Next Week with Coach" button that opens `WeeklyCheckInModal`
- **Completed:** 2026-03-13
- **Why:** When you finish all your workouts for the week, nothing happens. The weekly check-in is how Coach adjusts your program, but users skip it because they're never prompted. This catches them at peak satisfaction.
- **Files:** `src/pages/Home.tsx`, optionally `src/components/WeeklyViewCard.tsx`
- **Effort:** 1-2 hours

### Bonus Observations (not tasks, just notes)
- Onboarding is up to 20 steps across two gates — monitor for drop-off with more users
- Coach Dashboard vs Chat are two views on the same page; transition between them could be smoother later
- Gym profiles feel disconnected — user sets up equipment but Coach doesn't visibly reference it. Consider "Based on your home gym" note on suggestions later.

---

## Audit: Bug Fixes (March 2026)

> Found during full code scan on 2026-03-13. Sorted by severity.

### BF1. API Proxy Strips `response_format` (CRITICAL)
- [x] Add `response_format` passthrough to sanitized body in `api/openai/v1/chat/completions.js`
- **Completed:** 2026-03-13

### BF2. `Array(7).fill()` Creates Shared References (CRITICAL)
- [x] Replace all 4 instances in `src/db/weeklyPlanService.ts` with `Array.from({ length: 7 }, () => ({ templateId: null }))`
- **Completed:** 2026-03-13

### BF3. Records Page Hardcodes "lbs" Instead of User's Weight Unit (CRITICAL)
- [x] Added `getUserProfile` lookup and use `profile?.weightUnit || 'lbs'` in `formatValue`
- **Completed:** 2026-03-13

### BF4. Coach Roadmap Score Index Goes Negative (MEDIUM)
- [x] Guard array access with `scoreIdx >= 0` check before indexing `recentScores`
- **Completed:** 2026-03-13

### BF5. Coach Template Save Can Pass Undefined Values (MEDIUM)
- [x] Added `.filter(Boolean)` after exercise map in `handleResolveComplete`
- **Completed:** 2026-03-13

### BF6. GymEquipment Uses `Date.now()` Instead of `generateId()` (MEDIUM)
- [x] Replaced `Date.now()` with `generateId()` and added import
- **Completed:** 2026-03-13

### BF7. ExerciseCard Set IDs Missing `s-` Prefix (LOW)
- [x] Changed `id: generateId()` to `` id: `s-${generateId()}` `` in `addSet`
- **Completed:** 2026-03-13

### BF8. Home.tsx Score Properties Missing Optional Chaining (LOW)
- [x] Added optional chaining on `score?.overall`, `score?.consistency`, `score?.progression`, `score?.quality`
- **Completed:** 2026-03-13

### BF9. JSON.parse Without Specific Error Handling in AI Adapters (LOW)
- [x] Wrapped `JSON.parse()` in dedicated try-catch with log of raw content in both openaiAdapter.ts and alternativeProviders.ts
- **Completed:** 2026-03-13

### BF10. Review Orchestrator Reads Cleared localStorage (KNOWN LIMITATION)
- [x] Added `sourceTemplateId?: string` to `WorkoutHistory` interface in `database.ts`
- [x] `WorkoutContext.finishWorkout()` now persists `sourceTemplateId` into the history record
- [x] `reviewOrchestrator.ts` now reads `sourceTemplateId` directly from the workout record — localStorage fallback removed
- **Completed:** 2026-03-13

---

## Audit: Visual Polish

> Consistency and error handling improvements.

### VP1. Improve ErrorBoundary with Recovery + Friendly Message
- [x] Replace raw `error.toString()` with a user-friendly message
- [x] Add "Refresh" and "Go Home" buttons
- [x] Support dark mode (currently uses inline styles that ignore theme)
- [x] Optional: add global `window.onunhandledrejection` handler in `App.tsx` for async errors
- **Files:** `src/components/ErrorBoundary.tsx`, possibly `src/App.tsx`
- **Effort:** 3-5 hours
- **Completed:** 2026-03-07

### VP2. Extract Remaining Inline Styles
- [x] Readiness Pulse in `WorkoutLogger.tsx` (lines ~283-329): 8 nested elements all inline-styled → move to `WorkoutLogger.css`
- [x] `TemplateDetail.tsx` (lines ~139-265): 15+ elements with inline `style=` → create `TemplateDetail.css`
- **Why:** These violate the pattern everywhere else. Makes theming and dark mode fixes harder.
- **Files:** `WorkoutLogger.tsx` + `WorkoutLogger.css`, `TemplateDetail.tsx` + new `TemplateDetail.css`
- **Effort:** 2-4 hours
- **Completed:** 2026-03-07

---

## Recommended Implementation Order (Weeks 1-4)

> **Week 1: Trust and Safety** — QW1, QW2, QW3, then TS1
> **Week 2: Security and Polish** — TS3, QW4, QW5, TS4
> **Week 3: User Value** — UX1, VP2, VP1
> **Week 4: User Value + Quality** — UX2, TS2, UX3

---

## Opus UX Audit — Quick Fixes (March 2026)

> Found during full end-to-end UX audit on 2026-03-14. Each fix is under 1 hour. Ranked by user impact.

### QF1. Fix kg/lbs Bug in History and ExerciseDetails
- [ ] `History.tsx` line ~105: `{volume} kg Volume` → use `profile?.weightUnit ?? 'lbs'`
- [ ] `ExerciseDetails.tsx`: PR value display hardcodes "kg" — use user's weight unit instead
- **Why:** Every history card shows the wrong unit for lbs users. Factually wrong on every screen.
- **Files:** `src/pages/History.tsx`, `src/pages/ExerciseDetails.tsx`
- **Effort:** 30 min

### QF2. Remove Dead "⋮" Button from ExerciseCard
- [ ] The MoreVertical (3-dot) button renders on every exercise card but `onOptionsClick` is never passed in WorkoutLogger — it receives taps and does nothing
- [ ] Either remove the button entirely, or don't render it when `onOptionsClick` is undefined
- **Why:** Users tap it expecting a menu and get silence — every single workout.
- **Files:** `src/components/ExerciseCard.tsx`
- **Effort:** 15 min

### QF3. Allow Removing an Exercise from a Live Workout
- [ ] The trash icon only appears when `onRemoveClick` is passed — WorkoutLogger never passes it
- [ ] Add `handleRemoveExercise(exerciseId)` to WorkoutLogger and pass it as `onRemoveClick`
- **Why:** Users can't remove an exercise they've added mid-workout. Only escape is swap or cancel everything.
- **Files:** `src/pages/WorkoutLogger.tsx`, `src/components/ExerciseCard.tsx`
- **Effort:** 30 min

### QF4. Add Confirmation Before Clearing Coach Chat
- [ ] The trash icon in Coach clears the entire chat (including all workout reviews) with one tap — no warning
- [ ] Add a `ConfirmModal` with message: "This will permanently delete your Coach chat and all workout reviews. This cannot be undone."
- **Why:** One accidental tap destroys irreplaceable workout review history.
- **Files:** `src/pages/Coach.tsx`
- **Effort:** 20 min

### QF5. Hide "+ Custom" Button and "Watch Demo" Video Placeholder
- [ ] `ExerciseLibrary.tsx`: The "+ Custom" button shows a toast "coming soon" — better to just hide it until built
- [ ] `ExerciseDetails.tsx`: "Watch Demo" / PlayCircle button links nowhere — remove or hide it
- **Why:** Fake buttons that do nothing erode trust in the product.
- **Files:** `src/pages/ExerciseLibrary.tsx`, `src/pages/ExerciseDetails.tsx`
- **Effort:** 15 min

### QF6. Replace All `window.confirm()` Calls with ConfirmModal
- [ ] `Templates.tsx` — "Replace active workout?" uses native browser alert
- [ ] `TemplateDetail.tsx` — same issue
- [ ] `WorkoutDetail.tsx` — same issue (2 places: repeat + delete)
- **Why:** Native browser alert looks completely out of place in the polished app UI. 4 occurrences.
- **Files:** `src/pages/Templates.tsx`, `src/pages/TemplateDetail.tsx`, `src/pages/WorkoutDetail.tsx`
- **Effort:** 45 min

### QF7. Add Toast Confirmation After "Fill from Last" Button
- [ ] After tapping "Fill from Last", weights update silently — user has no feedback
- [ ] Show a brief toast: "Weights filled from your last session"
- **Why:** Without feedback, users don't know if the button worked.
- **Files:** `src/pages/WorkoutLogger.tsx`
- **Effort:** 15 min

---

## Opus UX Audit — Bigger Bets (March 2026)

> Larger improvements worth planning. High user impact but each takes more than a day.

### BB1. Slim Down Onboarding to 5–7 Steps
- [ ] Current flow: GoalSelectionGuard (9 steps) + ArchitectIntakeWizard (up to 11 steps) = 17–21 steps total
- [ ] Minimum to get started: goal, experience, weight unit, coach style — everything else asked later
- [ ] Spread Architect questions across first week of use ("progressive profiling")
- [ ] Remove the "Soon: BYO API Key" feature card from the welcome tour (advertises unbuilt feature)
- [ ] Remove the "skip (dev)" button — it's visible to all users
- **Why:** For a gym app, 20 steps before logging a single set is a massive activation barrier.
- **Files:** `src/components/GoalSelectionGuard.tsx`, `src/components/wizard/ArchitectIntakeWizard.tsx`
- **Effort:** 2–3 days

### BB2. Redesign Home Screen Hierarchy
- [ ] One dominant CTA: today's workout card — big, tappable, most important thing
- [ ] Remove "Plan with AI Coach" green button from home — it belongs only in the Coach tab
- [ ] Collapse week score + coach note into a single small card (not two separate sections)
- [ ] Horizontal scrollable template strip instead of full vertical list at the bottom
- [ ] "This Week" title and WeeklyViewCard title both say "This Week" — remove the page-level duplicate
- **Why:** Two competing primary CTAs + 6 stacked sections = decision paralysis on every open.
- **Files:** `src/pages/Home.tsx`, `src/pages/Home.css`
- **Effort:** 1–2 days

### BB3. Add "Edit Profile" in Settings
- [ ] Currently the only way to change goal, coach persona, experience level is "Reset & Start Over"
- [ ] Add an "Edit Profile" screen accessible from More that writes to the userProfile record
- [ ] Reuse the existing wizard step UI for each setting
- **Why:** Users who change goals are completely stuck without a destructive full reset.
- **Files:** `src/pages/More.tsx`, new `src/pages/EditProfile.tsx`, `src/db/database.ts`
- **Effort:** 1 day

### BB4. Elevate Records and Analytics in Navigation
- [ ] Consider replacing the "More" bottom nav slot with "Records" (trophy icon)
- [ ] Move Analytics into the History tab as a second tab (History already has a "Trends" sub-tab)
- [ ] More becomes purely a settings overflow (not a destination for core features)
- **Why:** Records and Analytics are core features buried 2 taps deep under More.
- **Files:** `src/App.tsx`, `src/components/BottomNav.tsx`, `src/pages/History.tsx`
- **Effort:** 1 day

### BB5. Full Exercise Interaction Polish
- [ ] Add ability to change set type (warmup/normal/drop/failure) during a live workout via tap on set badge
- [ ] Add a per-exercise notes field for form cues or pain points mid-session
- [ ] "Repeat This Workout" in WorkoutDetail currently resets all weights to 0 — should keep last weights or auto-fill
- [ ] Exercise variations in ExerciseDetails (progressions/regressions) look tappable but do nothing — wire them up
- **Why:** Power users hit these gaps quickly. Set types are already in the schema but not editable in-workout.
- **Files:** `src/components/SetRow.tsx`, `src/components/ExerciseCard.tsx`, `src/pages/ExerciseDetails.tsx`, `src/pages/WorkoutDetail.tsx`
- **Effort:** 2–3 days

### BB6. Build Custom Exercise Feature
- [ ] The schema already has `isCustom` flag and `aliases` array on Exercise
- [ ] Add a form (name, body part, category, optional notes) triggered from ExerciseLibrary "+ Custom" button
- [ ] Save to `db.exercises` with `isCustom: true`
- [ ] Show custom exercises in library with a badge or indicator
- **Why:** Serious lifters always have exercises not in any built-in library. This is a table-stakes feature.
- **Files:** `src/pages/ExerciseLibrary.tsx`, `src/db/exerciseService.ts`, new form component
- **Effort:** 1–2 days

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

### 2026-03-07
- **Full Product + Codebase Audit** completed
  - Scanned entire repo: ~85 files, ~14.8K lines across src/
  - Identified 10 ranked recommendations, 5 quick wins, 3 medium projects, 2 bigger bets
  - Added new sections to plan.md: Quick Wins (QW1-QW5), Trust & Safety (TS1-TS4), UX Improvements (UX1-UX3), Visual Polish (VP1-VP2)
  - Top priorities: finishWorkout transaction safety (TS1), API proxy hardening (TS3), onboarding progress dots (QW2)
  - Existing completed work preserved — all D1-D5 and A1-A5 tasks untouched
  - 4-week implementation order added to plan.md

- **QW1 Complete**: Add Loading State to "Finish & Save" Button
  - Added `isFinishing` state to `WorkoutLogger.tsx` that wraps the async `handleFinish` call
  - "Finish & Save" button now shows "Saving..." text and disables while save is in progress
  - Cancel button also disabled to prevent accidental cancels while saving
  - Prevents double-taps and provides visual feedback during the save operation
  - Build verified: no TypeScript errors
  - All 91 tests pass (including 70 from previous work)

- **QW2 Complete**: Add Progress Dots to Onboarding Wizard
  - Created `getTotalVisibleSteps()` helper to calculate visible steps accounting for beginner/goal skip logic
  - Created `generateDots()` helper to build boolean array where current step is marked true
  - Passed `dots` prop to all 9 WizardShell components (steps 1-9)
  - Non-beginner + Strength/Hypertrophy goals show 10 steps; Beginner + Consistency show 8 steps
  - Users now see progress indicator updating as they advance through wizard
  - Build verified: no TypeScript errors
  - All 91 tests pass

- **QW3 Complete**: Fix Dead "+ Custom" Button in Exercise Library
  - Added toast state and showToast helper function to ExerciseLibrary.tsx (copied pattern from Coach.tsx)
  - Wired onClick handler to button showing "Custom exercises coming soon!" message
  - Added .exercise-library-toast CSS styling with animations (based on Coach.css pattern)
  - Toast displays for 3 seconds and auto-dismisses
  - Honest UX approach: gives users immediate feedback without false promises
  - Database already supports custom exercises (isCustom flag exists), ready for full form feature later
  - Build verified: no TypeScript errors
  - All 91 tests pass

- **QW4 Complete**: Unify Modal Overlay Into One CSS Variable
  - Added `--color-overlay: rgba(0, 0, 0, 0.6)` to `src/index.css` (both :root and :root.dark)
  - Replaced 9 hardcoded overlay colors with `var(--color-overlay)` across 7 CSS files
  - Fixed critical z-index bugs: ReplaceModal z-index 2000 → var(--z-modal) (100) — was dangerously high
  - Applied fix to 6 modal overlays: FinishWorkoutSheet, ReplaceModal, WorkoutDetail, GymEquipment, AdjustWeekModal, WeeklyCheckInModal, ResolveExercisesModal
  - Replaced inline style overlays in WorkoutLogger.tsx and Home.tsx with CSS classes
  - Added .readiness-pulse-overlay and .template-confirm-overlay classes to respective CSS files
  - Build verified: no TypeScript errors
  - All 91 tests pass

- **QW5 Complete**: Add `role="dialog"` + Escape Key to ConfirmModal
  - Added `useEffect` hook to ConfirmModal.tsx for Escape key handling
  - Added `role="dialog"` and `aria-modal="true"` attributes to modal overlay div
  - When modal is open, pressing Escape calls onCancel() and closes modal
  - Keyboard listeners auto-cleanup on modal close or component unmount
  - Improves accessibility for screen readers and keyboard-only users
  - Since ConfirmModal is reused everywhere, this one fix improves accessibility across entire app
  - Build verified: no TypeScript errors
  - All 91 tests pass

### 2026-03-07 (continued, TS3)
- **TS3 Complete**: Harden the API Proxy
  - Added origin validation (localhost + vercel.app domains)
  - Added model whitelist (gpt-4o-mini, gpt-4o only)
  - Added token cap (max 4000)
  - Added messages validation (non-empty array required)
  - Added field sanitization (only safe fields forwarded to OpenAI)
  - Prevents abuse of proxy URL that's in JS bundle
  - Build verified: no TypeScript errors
  - All 91 tests pass

### 2026-03-07 (continued, UX1)
- **UX1 Complete**: Add "Repeat This Workout" to Workout Detail
  - Added `handleRepeat()` function to WorkoutDetail.tsx that clones exercises
  - Copies exercises with fresh IDs and resets isDone/weight flags
  - Added "Repeat This Workout" button with Play icon before Delete button
  - Added .wd-repeat-btn styling (green outline button)
  - Shows warning if user has active workout, offers to replace
  - Build verified: no TypeScript errors
  - All 91 tests pass

### 2026-03-07 (continued, TS4)
- **TS4 Complete**: Validate AI Response JSON Before Rendering
  - Added `validatePostWorkoutReview()` runtime type guard to types.ts
  - Checks all required fields: reviewSummary, wins, issues, prHighlights, weekProgress (with nested numbers), goalProgress, takeawaysTTL, takeawaysDurableCandidates
  - Updated ReviewCard.tsx to use validation instead of `as PostWorkoutReview` assertion
  - Two error states: "Review incomplete" and "Review could not be loaded" (both with Retry button)
  - Prevents silent rendering failures when AI returns malformed JSON
  - Build verified: no TypeScript errors
  - All 91 tests pass

### 2026-03-07 (continued, TS2)
- **TS1 Complete**: Wrap `finishWorkout` in a Dexie Transaction
  - Modified `finishWorkout()` in WorkoutContext.tsx to return `Promise<{ success: boolean; error?: string }>`
  - Wrapped all 3 DB operations in `db.transaction('rw', db.workoutHistory, db.weeklyPlans, db.prs, async () => {...})`
  - Operation 1: Save workout to workoutHistory
  - Operation 2: Update weekly plan with completed workout ID
  - Operation 3: Check and save PRs (wrapped in try/catch, failure doesn't roll back transaction)
  - Transaction atomically commits all 3 ops or rolls back all 3 if any fail
  - `cancelWorkout()` only called on success — prevents silent data loss
  - Updated usePostWorkoutReview.ts handleFinish() to check saveResult.success and return error
  - Updated handleFinish signature to return `Promise<{ goToCoach: boolean; error?: string }>`
  - Added error toast state to WorkoutLogger.tsx with 4-second auto-dismiss
  - Added .workout-logger-error-toast CSS styling with toast-down animation
  - If save fails, user sees red error toast and remains on WorkoutLogger (can retry)
  - If save succeeds, user navigates to /coach (if sendToCoach) or / (otherwise)
  - Build verified: resolved 7 TypeScript errors in type definitions
  - All 91 tests pass
  - Prevents data corruption from partial failures (workout saved but weekly plan/PRs skipped)

- **TS2 Complete**: Add "Soft Cancel" Recovery for Workouts
  - Added `getRecentlyCanceledWorkout()` helper to check localStorage for recently canceled workout (< 10 min old)
  - Added `clearRecentlyCanceledWorkout()` helper to clean up expired saves
  - Added `resumeRecentlyCanceledWorkout()` method to WorkoutContext
  - Modified `cancelWorkout()` to save current state (name, exercises, weights, startTime) before clearing
  - Updated WorkoutLogger.tsx to check for recently canceled workout on mount, show resume button if available
  - Added .resume-workout-btn styling (green outline button with Play icon, appears above primary button)
  - Auto-expires after 10 minutes to avoid clutter while preventing accidental data loss
  - Build verified: no TypeScript errors
  - All 91 tests pass

- **VP2 Complete**: Extract Remaining Inline Styles
  - Readiness Pulse (WorkoutLogger.tsx): Moved 8 nested inline styles to CSS classes (.readiness-pulse-sheet, .readiness-pulse-header, .readiness-pulse-buttons, .readiness-pulse-btn, .readiness-pulse-emoji, .readiness-pulse-label, .readiness-pulse-skip)
  - TemplateDetail.tsx: Extracted 15+ inline styles (header, input, buttons, sections)
  - Created new TemplateDetail.css with semantic classes (.template-detail-page, .template-detail-header, .template-detail-name-input, .template-detail-start-btn, .template-detail-exercises, .template-detail-add-btn, .template-detail-delete-btn)
  - Updated both components to use CSS classes instead of inline styles
  - Improves code readability and simplifies theming/dark mode changes
  - Build verified: no TypeScript errors
  - All 91 tests pass

- **VP1 Complete**: Improve ErrorBoundary with Recovery + Friendly Message
  - Replaced raw error.toString() with friendly message: "Something went wrong"
  - Added two action buttons: "Refresh Page" (reloads app) and "Go Home" (navigates to /)
  - Created ErrorBoundary.css with semantic styling that respects dark mode theme
  - Removed inline styles from ErrorBoundary.tsx (now uses CSS classes)
  - Added optional window.onunhandledrejection handler in App.tsx to catch async errors outside React
  - Errors still logged to console for debugging/monitoring
  - User sees clear recovery path instead of technical stack traces
  - Build verified: no TypeScript errors
  - All 91 tests pass

### 2026-03-07 (continued, A6)
- **A6 Complete**: Anthropic + Gemini Providers
  - Installed `@anthropic-ai/sdk` (v0.78.0) and `@google/generative-ai` (v0.24.1)
  - Implemented full `AnthropicProvider` in `alternativeProviders.ts`: all 3 methods using Anthropic Messages API (system prompt as separate param, `dangerouslyAllowBrowser: true` for BYOK)
  - Implemented full `GeminiProvider`: all 3 methods using `startChat()` for conversation history, `responseMimeType: 'application/json'` for JSON methods
  - Added `anthropicKey` + `geminiKey` to `AIConfig` in `useAIProvider.ts`; added `activeApiKey` helper that returns the right key per provider
  - Updated model IDs: Claude Sonnet 4.6 / Opus 4.6 / Haiku 4.5, Gemini 1.5 Pro / Flash
  - Updated pricing table for new Anthropic models
  - `AISettings.tsx`: all 3 providers enabled (no more "Coming Soon"), per-provider key input + help link shown conditionally
  - Build verified: no TypeScript errors, 91/91 tests pass

- **UX2 Complete**: Add "Fill From Last Session" to Workout Logger
  - Added `handleFillFromLastSession()` function to WorkoutLogger.tsx
  - Queries db.workoutHistory for each exercise in current workout
  - Finds most recent session containing that exerciseId
  - Extracts weight/reps from the last set performed
  - Auto-fills all empty sets (weight=0, reps=0) with previous values
  - Added "Fill from Last" button with Copy icon in exercises-list-controls
  - Button positioned alongside "Save as Template" and "Cancel" buttons
  - Tooltip explains: "Fill empty weights from your last workout"
  - Reduces daily friction: most users repeat similar weights each session
  - Build verified: no TypeScript errors
  - All 91 tests pass

### 2026-03-07 (continued, UX3)
- **UX3 Complete**: Template Lifecycle Improvements
  - `templateService.ts`: Added `removeTemplateFromWeeklyPlans()` — scans all weeklyPlans and nulls out any `dayAssignment.templateId` matching the deleted template; `deleteTemplate()` now calls this automatically
  - `TemplateDetail.tsx`: Added "Duplicate Template" button + ConfirmModal; handler calls `saveAsTemplate()` with `(Copy)` suffix and navigates to the new template
  - `TemplateDetail.css`: Added `.template-detail-duplicate-btn` neutral outline style (positioned above the red delete button)
  - `WorkoutDetail.tsx`: Fixed 3× hardcoded "kg" → `{weightUnit}` (total volume, per-exercise volume, per-set weight); uses `getUserProfile()` via `useLiveQuery`
  - `WorkoutDetail.tsx`: Added "Save as Template" button + ConfirmModal; saves past workout as a reusable template and navigates to /templates
  - `WorkoutDetail.css`: Added `.wd-save-template-btn` blue outline style
  - Build verified: no TypeScript errors
  - All 91 tests pass


### 2026-03-14
- **Opus UX Audit Complete**: Full end-to-end UX test across all 12 flows
  - Audited: Onboarding, Home, Workout Logger, Set Logging, Finish Flow, History, Templates, Records, Coach, Analytics, More/Settings, Exercise Library
  - Found 10 ranked issues (3 critical bugs, 4 serious, 3 moderate)
  - Found 5 wins (rest timer, finish flow, readiness pulse, weekly view, AI workout suggestions)
  - Added QF1–QF7 (quick fixes, each <1 hour) to plan.md
  - Added BB1–BB6 (bigger bets, each 1–3 days) to plan.md
  - Shipped all prior work to Vercel (A7, A8, A9, UXF6-7 + earlier UXF1-5)

### 2026-03-13
- **BF1-BF10 Complete**: Full codebase bug fix pass (10 bugs fixed)
  - BF1: API proxy now forwards `response_format` to OpenAI (was causing JSON parse failures in AI features)
  - BF2: Fixed `Array(7).fill()` shared-reference bug in weeklyPlanService — all 4 locations replaced with `Array.from()`
  - BF3: Records page now uses user's weight unit (lbs/kg) instead of hardcoded 'lbs'
  - BF4: Coach 6-week roadmap score lookup guarded against negative array index
  - BF5: Coach template save filtered to remove undefined exercise entries
  - BF6: GymEquipment custom IDs now use `generateId()` instead of `Date.now()`
  - BF7: ExerciseCard `addSet` IDs now include `s-` prefix for consistency
  - BF8: Home score properties use optional chaining (`score?.overall` etc.)
  - BF9: JSON.parse in AI adapters wrapped in try-catch with helpful error logging
  - BF10: `sourceTemplateId` now stored in WorkoutHistory — review orchestrator no longer relies on localStorage race condition
  - Build verified: zero TypeScript errors
  - All 91 tests pass
