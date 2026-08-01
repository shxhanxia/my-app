import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Catches render errors in its subtree so a failing section (e.g. the results
 * table) does not unmount the whole app.
 */
export default class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div className="bg-white rounded-2xl border border-red-200 p-6 text-red-600 text-sm">
                        Something went wrong rendering this section.
                    </div>
                )
            );
        }
        return this.props.children;
    }
}
