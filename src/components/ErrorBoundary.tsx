import React from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    handleRefresh = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-container">
                    <h2 className="error-boundary-title">Something went wrong</h2>
                    <p className="error-boundary-message">
                        We encountered an unexpected error. Try refreshing the page or go back home.
                    </p>
                    <div className="error-boundary-actions">
                        <button
                            className="error-boundary-btn error-boundary-btn-primary"
                            onClick={this.handleRefresh}
                        >
                            Refresh Page
                        </button>
                        <button
                            className="error-boundary-btn error-boundary-btn-secondary"
                            onClick={this.handleGoHome}
                        >
                            Go Home
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
