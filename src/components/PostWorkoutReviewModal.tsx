import { type AIPostWorkoutReview } from '../lib/ai/types';

interface PostWorkoutReviewModalProps {
    isOpen: boolean;
    isLoading: boolean;
    review: AIPostWorkoutReview | null;
    onClose: () => void;
}

export default function PostWorkoutReviewModal({
    isOpen,
    isLoading,
    review,
    onClose
}: PostWorkoutReviewModalProps) {
    if (!isOpen) return null;

    return (
        <div className="review-modal-overlay" onClick={onClose}>
            <div className="review-modal-sheet" onClick={e => e.stopPropagation()}>
                {isLoading ? (
                    <div className="review-loading">
                        <div className="review-emoji">✨</div>
                        <p className="review-loading-text">Generating your workout audit…</p>
                        <p className="review-loading-subtext">Comparing against previous sessions</p>
                    </div>
                ) : review ? (
                    <>
                        {/* Header */}
                        <div className="review-header">
                            <div>
                                <h2 className="review-title">Workout Audit</h2>
                                <p className="review-flag">{review.flag}</p>
                            </div>
                            {review.score && (
                                <div className="review-score-badge">
                                    {review.score}
                                </div>
                            )}
                        </div>

                        {/* PRs */}
                        {review.prs && review.prs.length > 0 && (
                            <div className="review-prs">
                                <p className="review-prs-title">🏆 Personal Records</p>
                                {review.prs.map((pr, i) => (
                                    <p key={i} className="review-pr-item">{pr}</p>
                                ))}
                            </div>
                        )}

                        {/* Wins */}
                        {review.wins && review.wins.length > 0 && (
                            <div className="review-wins">
                                <p className="review-wins-title">✅ High-Performance Wins</p>
                                {review.wins.map((w, i) => (
                                    <p key={i} className="review-win-item">{w}</p>
                                ))}
                            </div>
                        )}

                        {/* Fails */}
                        {review.fails && review.fails.length > 0 && (
                            <div className="review-fails">
                                <p className="review-fails-title">⚠️ Weak Links</p>
                                {review.fails.map((f, i) => (
                                    <p key={i} className="review-fail-item">{f}</p>
                                ))}
                            </div>
                        )}

                        {/* Alternates */}
                        {review.alternates && review.alternates.length > 0 && (
                            <div className="review-alternates">
                                <p className="review-alternates-title">💡 Try Instead</p>
                                {review.alternates.map((a, i) => (
                                    <p key={i} className="review-alternate-item">{a}</p>
                                ))}
                            </div>
                        )}

                        {/* Next Session */}
                        {review.nextSession && (
                            <div className="review-next-session">
                                <p className="review-next-session-title">🎯 Next Session</p>
                                <p className="review-next-session-text">{review.nextSession}</p>
                            </div>
                        )}

                        <p className="review-footer-text">Full audit saved to Coach chat</p>

                        <button className="review-done-btn" onClick={onClose}>
                            Done
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
}
