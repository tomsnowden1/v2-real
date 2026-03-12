import Dexie, { type EntityTable } from 'dexie';

export interface Exercise {
    id: string; // usually a UUID or short string
    name: string;
    category: string; // e.g., 'Barbell', 'Dumbbell', 'Machine'
    bodyPart: string; // e.g., 'Chest', 'Back', 'Legs'
    userNotes: string;
    isCustom: boolean; // true if created by user, false if from default library
    aliases?: string[]; // alternative names for fuzzy matching AI suggestions
    equipmentId?: string; // used later for Gym Profiles
    instructions?: string;
    gotchas?: string[]; // array of short tips e.g., 'brace core'
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    videoUrl?: string;
    imageUrl?: string;
    progressions?: string[]; // names of harder variations
    regressions?: string[]; // names of easier variations
}

export interface SetRecord {
    id: string;
    type: 'warmup' | 'normal' | 'failure' | 'drop';
    weight: number;
    reps: number;
    isDone: boolean;
    targetWeight?: number; // AI-suggested weight for this set (working sets only)
    targetReps?: number;   // AI-suggested reps for this set (working sets only)
    intensityLabel?: string; // e.g. "RPE 8" — display label shown next to the set
}

export interface WorkoutExercise {
    id: string; // unique to this workout instance
    exerciseId: string; // links to Exercise
    exerciseName?: string; // transient/denormalized property for easier rendering in UI
    supersetId?: string; // if part of a superset
    sets: SetRecord[];
}

export interface WorkoutHistory {
    id: string;
    name: string;
    startTime: number;
    endTime: number;
    durationMs: number;
    exercises: WorkoutExercise[];
    gymId?: string; // used later for Gym Profiles
    score?: {
        overall: number;
        consistency: number;
        progression: number;
        quality: number;
    };
}

export interface PRRecord {
    id: string;
    exerciseId: string; // links to Exercise
    workoutId: string; // links to WorkoutHistory where PR was hit
    metric: '1RM' | 'Max Volume' | 'Max Reps' | 'Max Weight';
    value: number; // The numeric value of the PR
    date: number; // timestamp
}

export interface CustomEquipmentItem {
    id: string;      // 'custom-<gymId>-<timestamp>'
    name: string;
    category: string;
}

export interface GymProfile {
    id: string;
    name: string; // e.g., 'Park Gym', 'Commercial Gym'
    availableEquipmentIds: string[]; // List of available equipment IDs (built-in + custom)
    customEquipment: CustomEquipmentItem[]; // User-defined equipment items
}

export interface StrengthBaselines {
    squat?: number;
    benchPress?: number;
    deadlift?: number;
    overheadPress?: number;
    barbellRow?: number;
    bicepCurl?: number;
}

export interface UserProfile {
    id: 'default'; // we only expect one profile right now
    goal: 'Consistency/Newborn' | 'Strength' | 'Hypertrophy' | 'Fat loss/Conditioning';
    coachPersona?: 'Supportive' | 'Direct' | 'Hard friend';
    postWorkoutReview?: 'None' | 'Brief' | 'Extended';
    theme?: 'Light' | 'Dark' | 'System';
    experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
    targetWorkoutDays?: number;
    preferences?: string; // Free-form constraints/injuries
    createdAt?: number; // timestamp of when the profile was first created
    weightUnit?: 'lbs' | 'kg'; // user's preferred weight unit
    weightSuggestionUI?: 'autofill' | 'placeholder' | 'badge'; // how AI weight suggestions are shown
    isBeginnerNoWeights?: boolean; // true if user skipped strength baseline (first-timer)
    strengthBaselines?: StrengthBaselines; // 8-rep comfortable weights from onboarding
    // Accountability Architect fields (set during ArchitectIntakeWizard)
    motivation?: string;              // why this goal matters to them
    accountabilityStatement?: string; // the "manifesto" they committed to
    currentBlockWeek?: number;        // 1-6 cycling block week counter
    isBeginner?: boolean;             // mirrors isBeginnerNoWeights for architect logic
    // Enhanced onboarding fields (v17)
    sessionDuration?: '30min' | '45min' | '60min' | '90min+';
    currentActivityLevel?: 'Sedentary' | 'Lightly Active' | 'Moderately Active' | 'Very Active';
    exercisePreferences?: string;     // e.g. "Compound lifts, no machines"
    consistencyBlockers?: string[];   // e.g. ["Early mornings", "Lack of time"]
    sleepHours?: '<6' | '6-7' | '7-8' | '8+';
    stressLevel?: 'Low' | 'Moderate' | 'High';
    onboardingComplete?: boolean;     // true once onboarding orchestrator has run
    personalContext?: string;         // free-text "Anything else?" from final onboarding step (max 300 chars)
}

export interface Template {
    id: string; // unique ID
    name: string; // e.g., 'Push Day', 'Upper Body Power'
    exercises: WorkoutExercise[];
    lastPerformed?: number; // timestamp
}

export interface DayAssignment {
    templateId: string | null; // null = rest day
    completedWorkoutId?: string; // set after workout is finished
}

export interface WeeklyPlan {
    id: string; // ISO week string e.g., '2023-10-W42' or just start of week timestamp
    weekStartDate: number; // timestamp for the monday of this week
    targetTemplateIds: string[]; // List of template IDs selected for this week (legacy, kept for compat)
    dayAssignments: DayAssignment[]; // Array of exactly 7 items. Index 0 = Monday, 6 = Sunday.
    completedWorkouts: string[]; // array of workoutHistory IDs
    hasCheckedIn?: boolean; // True if the user has completed the start-of-week check-in
    weeklyScore?: number;  // 0-100 adherence score; calculated from missed/recovered days
    summaryMetadata?: string; // AI-compressed snapshot of this week's performance (~30 words)
    aiRecap?: string; // AI-generated 2-3 sentence weekly recap shown on Home dashboard
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number; // ms — used for ordering
    // Review card fields (only present when type === 'review')
    type?: 'text' | 'review';
    reviewStatus?: 'pending' | 'complete' | 'error';
    reviewData?: string;       // JSON-encoded PostWorkoutReview
    reviewWorkoutId?: string;  // indexed — for idempotency checks
}

export interface Takeaway {
    id: string;
    workoutId: string;
    exerciseIds?: string[];              // exercises this applies to (for targeted advice)
    category: string;                   // 'Load Adjustment' | 'Form' | 'Recovery' | 'Programming'
    statement: string;                  // the actionable rule
    confidence: 'low' | 'med' | 'high';
    isDurable: boolean;                 // false = TTL (auto-saved), true = user-confirmed
    expiresAt?: number;                 // ms timestamp; undefined = never expires
    createdAt: number;
}

export interface RestTimerPref {
    exerciseId: string; // primary key
    durationSecs: number;
}

class IronDatabase extends Dexie {
    exercises!: EntityTable<Exercise, 'id'>;
    workoutHistory!: EntityTable<WorkoutHistory, 'id'>;
    prs!: EntityTable<PRRecord, 'id'>;
    gymProfiles!: EntityTable<GymProfile, 'id'>;
    userProfiles!: EntityTable<UserProfile, 'id'>;
    weeklyPlans!: EntityTable<WeeklyPlan, 'id'>;
    templates!: EntityTable<Template, 'id'>;
    chatMessages!: EntityTable<ChatMessage, 'id'>;
    restTimerPrefs!: EntityTable<RestTimerPref, 'exerciseId'>;
    takeaways!: EntityTable<Takeaway, 'id'>;

    constructor() {
        super('IronDB');

        // Define tables and indexes. 
        // We only index properties we plan to query on (like bodyPart, exerciseId, etc.)
        this.version(1).stores({
            exercises: 'id, name, bodyPart, category, isCustom',
            workoutHistory: 'id, startTime, name, gymId',
            prs: 'id, exerciseId, metric, date',
            gymProfiles: 'id, name'
        });

        // Version 2 adds userProfiles
        this.version(2).stores({
            userProfiles: 'id, goal'
        });

        // Version 3 adds weeklyPlans
        this.version(3).stores({
            weeklyPlans: 'id, weekStartDate'
        });

        // Version 4 adds templates
        this.version(4).stores({
            templates: 'id, name, lastPerformed'
        });

        // Version 5 migrates targetWorkouts to targetTemplateIds
        this.version(5).stores({
            weeklyPlans: 'id, weekStartDate' // Reprovision the store definition
        }).upgrade(tx => {
            return tx.table('weeklyPlans').toCollection().modify(plan => {
                if (!plan.targetTemplateIds) {
                    // Try to migrate gracefully, though effectively we just wipe the numbers
                    // since we can't map a raw integer like "3" to 3 real templates
                    plan.targetTemplateIds = [];
                }
            });
        });

        // Version 6 adds preferences to userProfiles
        this.version(6).stores({
            userProfiles: 'id, goal' // Keep existing indexes
        }).upgrade(tx => {
            return tx.table('userProfiles').toCollection().modify(profile => {
                if (profile.preferences === undefined) {
                    profile.preferences = '';
                }
            });
        });

        // Version 7 adds hasCheckedIn to weeklyPlans
        this.version(7).stores({
            weeklyPlans: 'id, weekStartDate'
        }).upgrade(tx => {
            return tx.table('weeklyPlans').toCollection().modify(plan => {
                if (plan.hasCheckedIn === undefined) {
                    // Default to true for existing plans so we don't pop the modal mid-week
                    plan.hasCheckedIn = true;
                }
            });
        });

        // Version 8 adds dayAssignments to weeklyPlans
        this.version(8).stores({
            weeklyPlans: 'id, weekStartDate'
        }).upgrade(tx => {
            return tx.table('weeklyPlans').toCollection().modify(plan => {
                if (!plan.dayAssignments) {
                    // Initialize with 7 empty days
                    const days: DayAssignment[] = Array(7).fill({ templateId: null });

                    // Try to map existing targetTemplateIds linearly to days if they exist
                    if (plan.targetTemplateIds && plan.targetTemplateIds.length > 0) {
                        plan.targetTemplateIds.forEach((tId: string, idx: number) => {
                            if (idx < 7) {
                                days[idx] = { templateId: tId };

                                // Best effort mapping of completed workouts
                                if (plan.completedWorkouts && plan.completedWorkouts.length > idx) {
                                    days[idx].completedWorkoutId = plan.completedWorkouts[idx];
                                }
                            }
                        });
                    }
                    plan.dayAssignments = days;
                }
            });
        });

        // Version 9 adds customEquipment to gymProfiles
        this.version(9).stores({
            gymProfiles: 'id, name'
        }).upgrade(tx => {
            return tx.table('gymProfiles').toCollection().modify((gym: GymProfile) => {
                if (!gym.customEquipment) {
                    gym.customEquipment = [];
                }
            });
        });

        // Version 10 adds createdAt to userProfiles
        this.version(10).stores({
            userProfiles: 'id, goal'
        }).upgrade(tx => {
            return tx.table('userProfiles').toCollection().modify(profile => {
                if (profile.createdAt === undefined) {
                    // Existing users are not new — set createdAt to epoch so they aren't suppressed
                    profile.createdAt = 0;
                }
            });
        });

        // Version 11 adds chatMessages (migrated from localStorage ironai_coach_history)
        this.version(11).stores({
            chatMessages: 'id, timestamp'
        });

        // Version 12 adds restTimerPrefs (migrated from localStorage ironai_rest_prefs)
        this.version(12).stores({
            restTimerPrefs: 'exerciseId'
        });

        // Version 13: add reviewWorkoutId index to chatMessages + new takeaways table
        this.version(13).stores({
            chatMessages: 'id, timestamp, reviewWorkoutId',
            takeaways: 'id, workoutId, isDurable, expiresAt'
        });

        // Version 14: add workoutId index to prs (needed for review orchestrator query)
        this.version(14).stores({
            prs: 'id, exerciseId, metric, date, workoutId'
        });

        // Version 15: adds optional fields to SetRecord (targetWeight, targetReps)
        // and UserProfile (weightUnit, weightSuggestionUI, isBeginnerNoWeights, strengthBaselines).
        // All new fields are optional — no migration needed.
        this.version(15).stores({});

        // Version 16: Accountability Architect fields.
        // New optional fields on SetRecord (intensityLabel), UserProfile (motivation,
        // accountabilityStatement, currentBlockWeek, isBeginner), and WeeklyPlan (weeklyScore).
        // All new fields are optional — no data migration needed.
        this.version(16).stores({});

        // Version 17: Enhanced onboarding fields on UserProfile.
        // New optional fields: sessionDuration, currentActivityLevel, exercisePreferences,
        // consistencyBlockers, sleepHours, stressLevel, onboardingComplete.
        // All optional — no data migration needed.
        this.version(17).stores({});

        // Version 18: Token compression — adds optional summaryMetadata to WeeklyPlan.
        // No index needed (never queried directly). No data migration needed.
        this.version(18).stores({});

        // Version 19: Adds optional personalContext to UserProfile.
        // Captured at the end of the onboarding wizard. No data migration needed.
        this.version(19).stores({});
    }
}

export const db = new IronDatabase();
