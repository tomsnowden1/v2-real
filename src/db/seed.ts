import { db, type Exercise } from '../db/database';
import { generatedExercises } from './seedData';

export const initialExercises: Partial<Exercise>[] = [
    {
        id: 'ex-bench-press',
        name: 'Bench Press (Barbell)',
        bodyPart: 'Chest',
        category: 'Barbell',
        isCustom: false,
        userNotes: '',
        aliases: ['bench', 'bench press'],
        instructions: 'Lie on the bench with eyes under the bar. Retract scapula, grab the bar slightly wider than shoulder-width. Unrack, lower to your mid-chest, and press up powerfully.',
        gotchas: ['Keep your wrists straight', 'Plant your feet firmly on the ground', 'Don\'t bounce the bar off your chest'],
        primaryMuscle: 'Chest',
        secondaryMuscles: ['Triceps', 'Anterior Deltoids'],
        progressions: ['Incline Bench Press', 'Paused Bench Press'],
        regressions: ['Dumbbell Bench Press', 'Push-ups']
    },
    {
        id: 'ex-squat',
        name: 'Squat (Barbell)',
        bodyPart: 'Legs',
        category: 'Barbell',
        isCustom: false,
        userNotes: '',
        aliases: ['barbell squat', 'back squat'],
        instructions: 'Rest the bar on your upper back. Brace your core, hinge at the hips, and bend your knees as if sitting in a chair. Keep chest up and push through your mid-foot to stand.',
        gotchas: ['Brace your core before descending', 'Don\'t let your knees cave inward', 'Go at least to parallel if mobility allows'],
        primaryMuscle: 'Quadriceps',
        secondaryMuscles: ['Glutes', 'Hamstrings', 'Lower Back', 'Core'],
        progressions: ['Front Squat', 'Pause Squat'],
        regressions: ['Goblet Squat', 'Leg Press']
    },
    {
        id: 'ex-deadlift',
        name: 'Deadlift (Barbell)',
        bodyPart: 'Back',
        category: 'Barbell',
        isCustom: false,
        userNotes: '',
        aliases: ['barbell deadlift'],
        instructions: 'Stand with mid-foot under the bar. Hinge at hips to grab the bar, bend knees until shins touch it. Pull chest up to flatten your back, take a deep breath, and stand up by pushing the floor away.',
        gotchas: ['Keep the bar touching your legs the whole way up', 'Do not round your lower back', 'Squeeze glutes at the top without hyperextending'],
        primaryMuscle: 'Hamstrings',
        secondaryMuscles: ['Glutes', 'Lower Back', 'Lats', 'Traps'],
        progressions: ['Deficit Deadlift', 'Romanian Deadlift'],
        regressions: ['Trap Bar Deadlift', 'Kettlebell Sumo Deadlift']
    },
    {
        id: 'ex-pullup',
        name: 'Pull Up',
        bodyPart: 'Back',
        category: 'Bodyweight',
        isCustom: false,
        userNotes: '',
        aliases: ['pullups', 'pull-ups', 'pull up'],
        instructions: 'Grab the bar with a pronated (overhand) grip slightly wider than shoulder width. Hang fully, then pull your chest to the bar by driving your elbows down and back.',
        gotchas: ['Start the movement by depressing your scapula', 'Avoid using momentum (kipping) unless intended', 'Don\'t cut the range of motion short at the bottom'],
        primaryMuscle: 'Lats',
        secondaryMuscles: ['Biceps', 'Rhomboids', 'Core'],
        progressions: ['Weighted Pull Ups', 'Muscle Ups'],
        regressions: ['Lat Pulldown', 'Assisted Pull Ups', 'Negatives']
    }
];

export async function seedDatabase() {
    const count = await db.exercises.count();
    if (count < 10) {
        console.log('Seeding initial exercises...');
        const allExercises = [...initialExercises, ...generatedExercises];
        await db.exercises.bulkPut(allExercises as Exercise[]);
    }
}
