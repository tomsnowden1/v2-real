export interface WeeklyRecapData {
    goal: string;
    planned: number;
    completed: number;
    missedDayNames: string[];  // e.g. ["Tuesday", "Thursday"]
    prList: string[];          // e.g. ["Bench Press (1RM: 225 lbs)"]
    weeklyScore?: number;
}

export function buildWeeklyRecapMessage(data: WeeklyRecapData): string {
    const { goal, planned, completed, missedDayNames, prList, weeklyScore } = data;
    const missedText = missedDayNames.length > 0 ? missedDayNames.join(', ') : 'none';
    const prText = prList.length > 0 ? prList.join('; ') : 'none';

    return `Write a coach's note for my athlete's training week. Exactly 2–3 sentences. Second person. Conversational. No emojis, no hashtags, no bullet points.

Training week data:
- Goal: ${goal}
- Sessions completed: ${completed} of ${planned} planned
- Days missed: ${missedText}
- Personal records set this week: ${prText}${weeklyScore !== undefined ? `\n- Week adherence score: ${weeklyScore}/100` : ''}

Rules:
- Vary the opening—never start with "This week", "Great job", or "Way to go"
- If PRs were hit, name them specifically
- If sessions were missed, acknowledge briefly then pivot forward
- Sound like a real coach who knows this athlete, not a motivational poster
- Return only the note itself, no preamble`;
}
