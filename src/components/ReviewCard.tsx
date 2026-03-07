import { useState } from 'react';
import { RefreshCw, Trophy, TrendingUp, AlertTriangle, Target, CheckCircle2, Clock } from 'lucide-react';
import type { ChatMessage, Takeaway } from '../db/database';
import type { PostWorkoutReview, TakeawayDurable } from '../lib/ai/types';
import { validatePostWorkoutReview } from '../lib/ai/types';
import { db } from '../db/database';
import { generateId } from '../lib/id';
import './ReviewCard.css';

interface ReviewCardProps {
    message: ChatMessage;
    onRetry?: (workoutId: string, messageId: string) => void;
}

export default function ReviewCard({ message, onRetry }: ReviewCardProps) {
    const [savedTakeaways, setSavedTakeaways] = useState<Set<number>>(new Set());
    const [dismissedTakeaways, setDismissedTakeaways] = useState<Set<number>>(new Set());

    // ── Pending state ─────────────────────────────────────────────────────────
    if (message.reviewStatus === 'pending') {
        return (
            <div className="review-card review-card--pending">
                <div className="review-card__pending-icon">🧠</div>
                <p className="review-card__pending-title">Analyzing your workout…</p>
                <p className="review-card__pending-sub">
                    Checking plan adherence, trends, PRs &amp; generating takeaways
                </p>
                <div className="review-card__pending-dots">
                    <span /><span /><span />
                </div>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────────────────
    if (message.reviewStatus === 'error') {
        let errorDetail: string | undefined;
        try {
            if (message.reviewData) {
                const parsed = JSON.parse(message.reviewData) as { errorMessage?: string };
                errorDetail = parsed.errorMessage;
            }
        } catch { /* ignore */ }

        return (
            <div className="review-card review-card--error">
                <AlertTriangle size={24} className="review-card__error-icon" />
                <p className="review-card__error-title">Review failed</p>
                <p className="review-card__error-sub">
                    {errorDetail ?? 'Check your API key and connection, then try again.'}
                </p>
                {onRetry && message.reviewWorkoutId && (
                    <button
                        className="review-card__retry-btn"
                        onClick={() => onRetry(message.reviewWorkoutId!, message.id)}
                    >
                        <RefreshCw size={14} />
                        Retry
                    </button>
                )}
            </div>
        );
    }

    // ── Complete state ────────────────────────────────────────────────────────
    if (message.reviewStatus !== 'complete' || !message.reviewData) return null;

    let review: PostWorkoutReview;
    try {
        const parsed: unknown = JSON.parse(message.reviewData);
        if (!validatePostWorkoutReview(parsed)) {
            return (
                <div className="review-card review-card--error">
                    <AlertTriangle size={24} className="review-card__error-icon" />
                    <p className="review-card__error-title">Review incomplete</p>
                    <p className="review-card__error-sub">
                        The AI returned an unexpected response. Retry to get a fresh review.
                    </p>
                    {onRetry && message.reviewWorkoutId && (
                        <button
                            className="review-card__retry-btn"
                            onClick={() => onRetry(message.reviewWorkoutId!, message.id)}
                        >
                            <RefreshCw size={14} />
                            Retry
                        </button>
                    )}
                </div>
            );
        }
        review = parsed;
    } catch {
        return (
            <div className="review-card review-card--error">
                <AlertTriangle size={24} className="review-card__error-icon" />
                <p className="review-card__error-title">Review could not be loaded</p>
                <p className="review-card__error-sub">
                    There was a problem reading the review data. Retry to get a fresh review.
                </p>
                {onRetry && message.reviewWorkoutId && (
                    <button
                        className="review-card__retry-btn"
                        onClick={() => onRetry(message.reviewWorkoutId!, message.id)}
                    >
                        <RefreshCw size={14} />
                        Retry
                    </button>
                )}
            </div>
        );
    }

    const handleSaveTakeaway = async (t: TakeawayDurable, idx: number) => {
        const record: Takeaway = {
            id: generateId(),
            workoutId: message.reviewWorkoutId ?? '',
            category: t.category,
            statement: t.statement,
            confidence: t.confidence,
            isDurable: true,
            createdAt: Date.now(),
        };
        await db.takeaways.add(record).catch(() => { /* non-critical */ });
        setSavedTakeaways(prev => new Set(prev).add(idx));
    };

    const handleDismissTakeaway = (idx: number) => {
        setDismissedTakeaways(prev => new Set(prev).add(idx));
    };

    const visibleDurables = (review.takeawaysDurableCandidates ?? [])
        .map((t, i) => ({ t, i }))
        .filter(({ i }) => !dismissedTakeaways.has(i));

    const weekPct = review.weekProgress.planned > 0
        ? Math.round((review.weekProgress.completed / review.weekProgress.planned) * 100)
        : 0;

    return (
        <div className="review-card review-card--complete">
            {/* ── Header ── */}
            <div className="review-card__header">
                <div className="review-card__header-left">
                    <span className="review-card__badge">Post-Workout Review</span>
                    {review.weekProgress.scoreTrend && (
                        <span className="review-card__trend">{review.weekProgress.scoreTrend}</span>
                    )}
                </div>
                <div className="review-card__score">
                    {review.weekProgress.score}<span>/100</span>
                </div>
            </div>

            {/* ── Summary bullets ── */}
            {review.reviewSummary?.length > 0 && (
                <ul className="review-card__summary">
                    {review.reviewSummary.map((s, i) => (
                        <li key={i}>{s}</li>
                    ))}
                </ul>
            )}

            {/* ── PRs ── */}
            {review.prHighlights?.length > 0 && (
                <div className="review-card__section review-card__section--prs">
                    <div className="review-card__section-header">
                        <Trophy size={14} />
                        Personal Records
                    </div>
                    {review.prHighlights.map((pr, i) => (
                        <div key={i} className="review-card__pr-row">
                            <span className="review-card__pr-label">{pr.label}</span>
                            <span className="review-card__pr-value">{pr.value}</span>
                            {pr.whyItMatters && (
                                <p className="review-card__pr-context">{pr.whyItMatters}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Wins ── */}
            {review.wins?.length > 0 && (
                <div className="review-card__section review-card__section--wins">
                    <div className="review-card__section-header">
                        <CheckCircle2 size={14} />
                        Wins
                    </div>
                    <ul className="review-card__list">
                        {review.wins.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            )}

            {/* ── Issues ── */}
            {review.issues?.length > 0 && (
                <div className="review-card__section review-card__section--issues">
                    <div className="review-card__section-header">
                        <AlertTriangle size={14} />
                        Issues
                    </div>
                    {review.issues.map((issue, i) => (
                        <div key={i} className="review-card__issue">
                            <p className="review-card__issue-title">{issue.title}</p>
                            <p className="review-card__issue-evidence">{issue.evidence}</p>
                            <p className="review-card__issue-cause">
                                <strong>Cause:</strong> {issue.probableCause}
                            </p>
                            <p className="review-card__issue-fix">
                                <strong>Next time:</strong> {issue.nextTimeChange}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Week Progress ── */}
            <div className="review-card__section review-card__section--week">
                <div className="review-card__section-header">
                    <TrendingUp size={14} />
                    Week Progress
                </div>
                <div className="review-card__week-row">
                    <span>{review.weekProgress.completed} / {review.weekProgress.planned} workouts</span>
                    <span className="review-card__week-pct">{weekPct}%</span>
                </div>
                <div className="review-card__week-bar">
                    <div className="review-card__week-bar-fill" style={{ width: `${Math.min(weekPct, 100)}%` }} />
                </div>
                {review.weekProgress.nextPlannedWorkout && (
                    <p className="review-card__week-next">
                        <Clock size={12} />
                        Next: {review.weekProgress.nextPlannedWorkout}
                    </p>
                )}
            </div>

            {/* ── Goal Progress ── */}
            {review.goalProgress?.length > 0 && (
                <div className="review-card__section review-card__section--goal">
                    <div className="review-card__section-header">
                        <Target size={14} />
                        Goal Progress
                    </div>
                    <ul className="review-card__list">
                        {review.goalProgress.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                </div>
            )}

            {/* ── Durable takeaway chips ── */}
            {visibleDurables.length > 0 && (
                <div className="review-card__section review-card__section--takeaways">
                    <div className="review-card__section-header">
                        💡 Save as a Rule?
                    </div>
                    <p className="review-card__takeaways-sub">These insights might be worth remembering long-term.</p>
                    {visibleDurables.map(({ t, i }) => (
                        <div key={i} className="review-card__takeaway-chip">
                            <div className="review-card__takeaway-meta">
                                <span className="review-card__takeaway-category">{t.category}</span>
                                <span className={`review-card__takeaway-conf review-card__takeaway-conf--${t.confidence}`}>
                                    {t.confidence}
                                </span>
                            </div>
                            <p className="review-card__takeaway-statement">{t.statement}</p>
                            {savedTakeaways.has(i) ? (
                                <span className="review-card__takeaway-saved">✓ Saved</span>
                            ) : (
                                <div className="review-card__takeaway-actions">
                                    <button
                                        className="review-card__takeaway-btn review-card__takeaway-btn--save"
                                        onClick={() => handleSaveTakeaway(t, i)}
                                    >
                                        Save rule
                                    </button>
                                    <button
                                        className="review-card__takeaway-btn review-card__takeaway-btn--dismiss"
                                        onClick={() => handleDismissTakeaway(i)}
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
