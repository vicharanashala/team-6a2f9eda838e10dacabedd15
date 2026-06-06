'use client';
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught runtime exception:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = 
        this.state.error?.message?.includes('ChunkLoadError') || 
        this.state.error?.message?.includes('loading chunk') ||
        this.state.error?.name === 'ChunkLoadError';

      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6 bg-[var(--color-bg)]">
          <div className="max-w-md w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl mx-auto animate-pulse">
              🔌
            </div>
            
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-[var(--color-text)]">
                {isChunkError ? 'Offline Resource Unavailable' : 'Application Load Issue'}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {isChunkError 
                  ? 'The page details you are trying to view require a network connection to load the latest layout. Please check your internet connection and try again.'
                  : 'An error occurred while rendering the page. This is usually caused by a network disconnection or hydration mismatch.'}
              </p>
            </div>

            <div className="p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] text-left">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] block mb-1">
                Details
              </span>
              <code className="text-[10px] font-mono text-amber-600 dark:text-amber-400 break-all">
                {this.state.error?.message || 'Unknown render exception'}
              </code>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={this.handleRetry}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 hover:opacity-90 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow transition-all duration-300 active:scale-95"
              >
                Retry Loading
              </button>
              <a
                href="/"
                className="w-full sm:w-auto px-5 py-2.5 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-semibold text-xs tracking-wider uppercase rounded-xl transition-all duration-300 text-center flex items-center justify-center"
              >
                Go to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
