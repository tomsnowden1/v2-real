# IronAI Task List

## Milestones

### V1 (Ship first)
#### Goal & Setup
- [x] **Goal Selection**: User chooses a PRIMARY goal mode (required): Consistency/Newborn, Strength, Hypertrophy, Fat loss/Conditioning.
- [x] **Weekly Checklist**: Implement weekly checklist format (no calendar/day scheduling).
- [x] **Adjust Week Trigger**: Add "Adjust my week" user-triggered setup to change the schedule.

#### Coach & Workflow
- [x] **Coach Program Suggestion**: Allow Coach to suggest suitable program structures (e.g., upper/lower, PPL) while keeping UI checklist-based.
- [x] **Coach Draft Workouts**: Coach generates workouts/templates as DRAFT artifacts in the Coach UI.
- [x] **Canonical Builder Parity**: Allow pushing/opening drafts in the same canonical builder/editor used for manual creation. Anything the coach creates/edits is doable manually.
- [x] **Silent Ingestion**: Saved workouts become contextual data for future coach generations (silent ingestion).
- [x] **Coach Persona Settings**: Add Coach style setting (Supportive / Direct / Hard friend). Coach must never shame.

#### Scoring System
- [x] **Scoring System - Consistency**: Implement Consistency score based on checklist completion.
- [x] **Scoring System - Progression**: Implement Progression score (key lifts only, compare last time). Strength uses e1RM proxy; Hypertrophy uses volume load.
- [x] **Scoring System - Quality**: Implement Quality score (planned sets completed + optional RPE).
- [x] **Scoring System - Weighting**: Base weighted overall score on the Goal mode weightings (e.g. Strength = 35% Cons, 45% Prog, 20% Qual).
- [x] **Scoring System - UI**: Show score breakdown in UI ("why" behind the score).

#### Post-workout Review
- [x] **Post-Workout Review Options**: Implement post-workout review settings (Brief vs Extended). Brief = insight + next suggestion + flag. Extended = Brief + trends/rationale. (Post-workout review is optional).

#### Hard UX / Scope Constraints
- [x] **Strict Gym Equipment Rules**: Gym/workout space equipment constraints must be strict (forbid unlisted equipment).
- [x] **Advanced Features Accordion**: Hide advanced options (supersets, rest timers, RPE, load suggestions) behind an "Advanced" accordion to keep logger minimal.
- [x] **Home biases "Start Next**": Ensure Home screen biases toward "Start next workout" + week checklist.
- [x] **Last Time Visibility**: Show "Last time" in logger near inputs; targets remain optional.
- [x] **Template as Source of Truth**: Keep Template as source-of-truth; Program/Week Plan references templates.
- [x] **Structured AI Artifacts**: Coach proposes structured operations / artifacts, not free-form silent mutations.

### V2 (Next)
- [x] **Onboarding Wizard**: Build Onboarding wizard (Select Goal, Schedule inputs, equipment/spaces, experience level, preferences, constraints, coach style).
- [x] **Adaptive Weekly Check-in**: Implement check-in (at boundary or via "Adjust"): assess availability, injuries, variety preference, satisfaction.
- [x] **Dynamic Coach Updates**: Coach updates next week templates dynamically (volume/targets/swaps/progressions) during check-in.
- [x] **Progress Views**: Build better Progress views displaying weekly/monthly trends.

### V3 (Later)
- [x] **BYO AI Provider Framework**: Build adapter interface for LLMs (OpenAI, Gemini, etc).
- [x] **BYO AI Setup Screen**: Create UI for provider dropdown, local-storage warning, test connection, and model picker (cost/quality tags).
- [ ] **API Budget Guardrails**: Add monthly API budget cap, usage meter, and fallback logic if cap hit.
- [ ] **API Key Instructions Video**: Add optional "how to get an API key" video embed/placeholder.

## Legacy/Implemented Phases

- [x] **Phase 1: Project Setup & Core Navigation**
  - [x] Initialize Vite React TypeScript project.
  - [x] Set up global CSS and design tokens for a premium, minimalistic aesthetic.
  - [x] Create core mobile navigation bar (Workout, History, Coach, More).
  - [x] Build basic responsive layout (mobile-first).

- [x] **Phase 2: Workout Logger UI**
  - [x] Build clean, minimalistic "Active Workout" screen.
  - [x] Implement UI for adding/removing sets, inputting weight/reps, and marking sets as done.
  - [x] Implement UI for replacing/creating exercises in a workout.
  - [x] Implement UI for rearranging exercise order.
  - [x] Implement superset grouping UI.

- [x] **Phase 3: AI Coach Integration**
  - [x] Build conversational UI for the Coach tab.
  - [x] Build UI to securely input and store OpenAI API key locally.
  - [x] Implement response parsing to convert AI suggestions into structured workout components natively openable in the app.

- [x] **Phase 4: Exercise Objects & Local Database**
  - [x] Set up Dexie.js (IndexedDB) for local data persistence.
  - [x] Define data structures for independent exercise objects (PRs, notes, progression).
  - [x] Build Exercise Library screen in the "More" tab.

- [x] **Phase 5: Gym Profiles & Equipment**
  - [x] Build Gym Profiles management UI (e.g., 'Park Gym' vs 'Commercial Gym').
  - [x] Create UI to select available equipment for a specific profile.

- [x] **Phase 6: Data Persistence, Polish & Robustness**
  - [x] Create global WorkoutContext to persist active workout state across tabs.
  - [x] Wire AI Coach "Apply" button to populate the active workout context.
  - [x] Implement saving finished workouts to Dexie database.
  - [x] Build History tab UI to view past workouts.
  - [x] Implement Bulletproof 'Apply to Logger' Parsing (JSON Mode + try/catch error handling).
  - [x] Protect WorkoutContext Data (Auto-save Cache + Confirmation Modals).
  - [x] Implement Timestamp-Based Rest Timer.

- [x] **Phase 7: Environment Configuration**
  - [x] Create `.env.local` to store OpenAI API key.
  - [x] Update `useOpenAIKey` hook to prioritize the environment variable over localStorage.
  - [x] Verify Coach UI automatically bypasses setup if ENV key exists.

- [x] **Phase 8: Exercise Matching & Coach History**
  - [x] Add `aliases` property to Database `Exercise` schema.
  - [x] Create `findOrCreateExerciseByName` service with fuzzy matching logic.
  - [x] Refactor `WorkoutContext.applySuggestion` to seed real DB Exercise IDs.
  - [x] Persist `Coach.tsx` chat history array to `localStorage`.

- [x] **Phase 9: Exercise Details & Analytics View**
  - [x] Add rich content fields (instructions, gotchas, muscles) to `Exercise` schema.
  - [x] Update `seed.ts` with detailed information for default exercises.
  - [x] Install `recharts` for data visualization.
  - [x] Build `/exercises/:id` page (`ExerciseDetails.tsx`) displaying stats, charts, and instructions.
  - [x] Wire routing from `WorkoutLogger` and `ExerciseLibrary` to the new Details page.

- [x] **Phase 10: UX Refinements & Future Placeholders**
  - [x] Query and render `PRRecord`s in `ExerciseDetails.tsx`.
  - [x] Build visual blocks for `progressions` and `regressions`.
  - [x] Enhance YouTube video integration placeholder UI.

- [x] **Phase 11: Gym Profile Context Integration**
  - [x] Extract `EQUIPMENT_DB` into `src/db/equipment.ts`.
  - [x] Update `sendMessageToCoach` to accept and attach `additionalContext` to `SYSTEM_PROMPT`.
  - [x] Fetch `GymProfile`s in `Coach.tsx` and build a readable equipment context string.
  - [x] Pass the context string into `sendMessageToCoach`.

- [x] **Phase 12: Context Refinement**
  - [x] Rewrite the `gymContextString` in `Coach.tsx` using stronger, imperative instructions to forbid unlisted equipment.

- [x] **Phase 13: Improving Equipment Matching & UX**
  - [x] Update `Coach.tsx` prompt to allow fuzzy gym name matching.
  - [x] Refactor `GymEquipment.tsx` to group equipment by Category.
